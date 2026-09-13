// Check the rendered contract, including metadata inherited from the layout.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SITE_URL } from "./site-url.mjs";

const origin = new URL(process.argv[2] || SITE_URL).origin;
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const failures = [];
let checks = 0;

async function get(path, options) {
  return fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(15000) });
}

function check(condition, message) {
  checks++;
  if (!condition) failures.push(message);
}

function decode(value) {
  return value?.replaceAll("&amp;", "&").replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function meta(html, key) {
  const tags = html.match(/<meta\s[^>]+>/g) ?? [];
  return decode(tags.find((tag) => tag.includes(`="${key}"`))?.match(/content="([^"]*)"/)?.[1]);
}

const sitemap = await get("/sitemap.xml");
assert.equal(sitemap.status, 200, "sitemap must load");
const paths = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => new URL(decode(match[1])).pathname);
assert(paths.length > 0, "sitemap must list pages");

// Bounded batches avoid a burst of Worker invocations during verification.
for (let start = 0; start < paths.length; start += 4) {
  await Promise.all(paths.slice(start, start + 4).map(async (path) => {
    try {
      const response = await get(path);
      const html = await response.text();
      const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1]);
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      check(response.status === 200, `${path}: HTTP ${response.status}`);
      check(response.headers.get("content-type")?.includes("text/html"), `${path}: HTML missing`);
      check(response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), `${path}: CSP missing`);
      check(response.headers.get("x-frame-options") === "DENY", `${path}: frame protection missing`);
      check(Boolean(title), `${path}: title missing`);
      check(Boolean(canonical) && new URL(canonical).pathname === path, `${path}: wrong canonical`);
      check(Boolean(meta(html, "og:url")) && new URL(meta(html, "og:url")).pathname === path, `${path}: wrong share URL`);
      check(meta(html, "og:title") === title, `${path}: share title differs from page title`);
      check(meta(html, "og:description") === meta(html, "description"), `${path}: share description differs from page description`);
      check(Boolean(meta(html, "og:image")), `${path}: share image missing`);
      const stamp = html.match(/<span class="build-stamp" title="([a-f0-9]{40,64})">([\s\S]*?)<\/span>/);
      check(Boolean(stamp) && stamp[2].replace(/<[^>]*>/g, "").startsWith(`v${version} · ${stamp[1].slice(0, 7)}`), `${path}: release version/revision missing`);
      const builtAt = stamp?.[2].match(/<time dateTime="([^"]+)"|<time datetime="([^"]+)"/)?.slice(1).find(Boolean);
      check(Boolean(builtAt) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(builtAt) && Number.isFinite(Date.parse(builtAt)), `${path}: release timestamp missing`);
      console.log(`${path}: ${response.status}`);
    } catch (error) {
      failures.push(`${path}: ${error.message}`);
    }
  }));
}

const missing = await get("/legal/not-a-document");
check(missing.status === 404, "unknown legal document must be 404");
const manifestResponse = await get("/manifest.webmanifest");
check(manifestResponse.status === 200, "manifest must load");
const manifest = await manifestResponse.json();
for (const shortcut of manifest.shortcuts ?? []) {
  const response = await get(shortcut.url, { redirect: "manual" });
  check(response.status === 307, `${shortcut.url}: shortcut must redirect temporarily`);
  check(new URL(response.headers.get("location")).origin !== origin, `${shortcut.url}: shortcut must reach a game`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`${failures.length} failures across ${checks} checks`);
  process.exitCode = 1;
} else {
  console.log(`${checks} checks passed across ${paths.length} pages and the manifest shortcuts`);
}
