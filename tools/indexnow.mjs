#!/usr/bin/env node
// Tell the IndexNow engines that these pages exist.
//
// IndexNow is a push protocol: instead of waiting to be crawled, a site posts
// the list of addresses it wants looked at. Bing, Yandex, Seznam and Naver
// share one endpoint, so a single submission reaches all of them. Google does
// not participate, and nothing here does anything for Google.
//
// Ownership is proved by serving a file at the root of the host whose name is
// the key and whose body is the key. `public/<key>.txt` is that file, and it
// is the only place the key is written down: this script finds it rather than
// carrying a second copy that can disagree with what is deployed.
//
// The list of addresses comes from the live sitemap, which is generated from
// `ROUTES` in `src/lib/brand.ts`. So adding a page to the site adds it here,
// and a page that is not in the sitemap is not submitted, both on purpose.
//
// Run it after a deploy, never before: the key file has to be reachable at the
// address being claimed, and the pages being submitted have to exist.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SITE_URL } from "./site-url.mjs";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));
const KEY_FILE = /^[0-9a-f]{8,128}\.txt$/;

function readKey() {
  const found = readdirSync(PUBLIC_DIR).filter((name) => KEY_FILE.test(name));
  if (found.length !== 1) {
    throw new Error(`indexnow: expected exactly one key file in public/, found ${found.length}`);
  }
  const key = found[0].replace(/\.txt$/, "");
  const body = readFileSync(`${PUBLIC_DIR}/${found[0]}`, "utf8").trim();
  // A key file whose body is not its name proves nothing, and the engines
  // reject the submission rather than say why.
  if (body !== key) {
    throw new Error(`indexnow: ${found[0]} does not contain its own key`);
  }
  return key;
}

async function readSitemap(origin) {
  const response = await fetch(`${origin}/sitemap.xml`);
  if (!response.ok) throw new Error(`indexnow: sitemap answered ${response.status}`);
  const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) throw new Error("indexnow: sitemap listed nothing");
  return urls;
}

const key = readKey();
const origin = SITE_URL.replace(/\/$/, "");
const host = new URL(origin).host;
const keyLocation = `${origin}/${key}.txt`;

// Check the proof before claiming the host. A deploy that has not gone out yet
// fails here, with the reason, rather than at the endpoint with a bare 403.
const proof = await fetch(keyLocation);
if (!proof.ok || (await proof.text()).trim() !== key) {
  throw new Error(`indexnow: ${keyLocation} does not serve the key yet`);
}

const urlList = await readSitemap(origin);
const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
});

console.log(`indexnow: ${host}, ${urlList.length} addresses, ${response.status} ${response.statusText}`);
// 200 is accepted, 202 is accepted with the key still being checked. Anything
// else is a refusal, and a refusal that exits 0 is a submission nobody made.
if (![200, 202].includes(response.status)) {
  console.error(await response.text());
  process.exit(1);
}
