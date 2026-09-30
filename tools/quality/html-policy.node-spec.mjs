import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { compressHtml, protectHtml, writeHtmlPolicyWorker } from "../html-policy.mjs";

test("HTML keeps private cache directives, cookies, status and streamed body", async () => {
  const original = new Response("<html>private</html>", { status: 401, headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "set-cookie": "session=abc; Secure; HttpOnly",
  } });
  const protectedResponse = protectHtml(original);
  assert.equal(protectedResponse.status, 401);
  assert.equal(protectedResponse.headers.get("cache-control"), "private, no-cache, no-store, max-age=0, must-revalidate, no-transform");
  assert.equal(protectedResponse.headers.get("set-cookie"), original.headers.get("set-cookie"));
  assert.equal(await protectedResponse.text(), "<html>private</html>");
});

test("HTML without a cache policy does not become public or cacheable", () => {
  const response = protectHtml(new Response("", { headers: { "content-type": "TEXT/HTML" } }));
  assert.equal(response.headers.get("cache-control"), "max-age=0, must-revalidate, no-transform");
});

test("an existing transformation directive is preserved while browser freshness is replaced", () => {
  const response = new Response("", { headers: { "content-type": "text/html", "cache-control": "public, NO-TRANSFORM, max-age=60" } });
  const protectedResponse = protectHtml(response);
  assert.equal(protectedResponse.headers.get("cache-control"), "public, NO-TRANSFORM, max-age=0, must-revalidate");
  assert.equal(protectHtml(protectedResponse), protectedResponse);
});

test("browser documents revalidate without discarding shared-cache freshness", () => {
  const response = protectHtml(new Response("", { headers: {
    "content-type": "text/html",
    "cache-control": "s-maxage=31536000, stale-while-revalidate=2592000, stale-if-error=86400",
  } }));
  assert.equal(response.headers.get("cache-control"), "s-maxage=31536000, max-age=0, must-revalidate, no-transform");
});

test("strict private policies never acquire shared or browser freshness", () => {
  for (const directive of ["no-cache", "no-store"]) {
    const response = protectHtml(new Response("", { headers: {
      "content-type": "text/html",
      "cache-control": `private, ${directive}, stale-while-revalidate=60`,
    } }));
    assert.equal(response.headers.get("cache-control"), `private, ${directive}, no-transform`);
  }
});

test("non-HTML responses retain their identity and headers", () => {
  for (const type of ["application/json", "text/x-component", "image/svg+xml", "text/html-not-really", ""]) {
    const response = new Response("body", { headers: { "content-type": type } });
    assert.equal(protectHtml(response), response);
  }
});

test("generated entry point delegates fetch, other handlers and named exports", async () => {
  const app = mkdtempSync(join(tmpdir(), "gtg-html-policy-"));
  try {
    mkdirSync(join(app, ".open-next"));
    writeFileSync(join(app, "package.json"), '{"type":"module"}');
    const original = `export class QueueHandler {}
export default { marker: "worker", scheduled: () => "scheduled", fetch(request, env, ctx) {
  if (this.marker !== "worker" || env.value !== "env" || ctx.value !== "ctx") throw new Error("lost delegate context");
  return new Response(request.url, { headers: { "content-type": "text/html", ...(request.url.includes("public") ? { "cache-control": "public", "x-nextjs-prerender": "1", "x-opennext-cache": "HIT" } : {}) } });
} };`;
    writeFileSync(join(app, ".open-next/worker.js"), original);
    writeHtmlPolicyWorker(app);
    assert.equal(existsSync(join(app, ".open-next/assets/runtime-policy.mjs")), false);
    assert.equal(readFileSync(join(app, ".open-next/worker.js"), "utf8"), original);
    const wrapper = await import(pathToFileURL(join(app, ".open-next/worker-no-transform.js")));
    const worker = await import(pathToFileURL(join(app, ".open-next/worker.js")));
    assert.equal(wrapper.QueueHandler, worker.QueueHandler);
    assert.equal(wrapper.default.scheduled, worker.default.scheduled);
    const response = await wrapper.default.fetch(new Request("https://example.com/"), { value: "env" }, { value: "ctx" });
    assert.equal(response.headers.get("cache-control"), "max-age=0, must-revalidate, no-transform");
    assert.equal(await response.text(), "https://example.com/");
    const compressed = await wrapper.default.fetch(new Request("https://example.com/public", { headers: { "accept-encoding": "gzip" } }), { value: "env" }, { value: "ctx" });
    assert.equal(compressed.headers.get("content-encoding"), "gzip");
    assert.equal(await new Response(compressed.body.pipeThrough(new DecompressionStream("gzip"))).text(), "https://example.com/public");
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

test("publishing the helper produces the exact canonical source bytes", () => {
  const app = mkdtempSync(join(tmpdir(), "gtg-html-policy-source-"));
  try {
    mkdirSync(join(app, ".open-next"));
    writeFileSync(join(app, ".open-next/worker.js"), "export default {};");
    writeHtmlPolicyWorker(app, true);
    assert.deepEqual(readFileSync(join(app, ".open-next/assets/runtime-policy.mjs")),
      readFileSync(new URL("../html-policy.mjs", import.meta.url)));
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

function publicHtml(body = "<html>" + "same document ".repeat(1000) + "</html>", extra = {}) {
  return protectHtml(new Response(body, { headers: { "content-type": "text/html", "cache-control": "public, s-maxage=60", "x-nextjs-prerender": "1", "x-opennext-cache": "HIT", ...extra } }));
}
function compressionRequest(encoding, extra = {}) {
  return new Request("https://example.com/", { headers: { ...(encoding === null ? {} : { "accept-encoding": encoding }), ...extra } });
}

test("public gzip streams roundtrip exact bytes and preserve no-transform and cache policy", async () => {
  const original = publicHtml();
  const expected = await original.clone().text();
  const response = compressHtml(original, compressionRequest("br, gzip"));
  assert.equal(response.headers.get("content-encoding"), "gzip");
  assert.match(response.headers.get("cache-control"), /no-transform/);
  assert.match(response.headers.get("cache-control"), /s-maxage=60/);
  assert.match(response.headers.get("vary"), /Accept-Encoding/);
  const bytes = await response.arrayBuffer();
  assert.ok(bytes.byteLength < expected.length / 2);
  const decoded = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")));
  assert.equal(await decoded.text(), expected);
});

test("unmarked streaming HTML preserves its response and delivers the shell before the tail", async () => {
  const shell = new TextEncoder().encode("<html><head><link rel=stylesheet href=/shell.css></head><body>Visible shell");
  const tail = new TextEncoder().encode("</body></html>");
  let source;
  const body = new ReadableStream({ start(controller) { source = controller; controller.enqueue(shell); } });
  const original = protectHtml(new Response(body, { headers: { "content-type": "text/html", "cache-control": "public, s-maxage=60" } }));
  const response = compressHtml(original, compressionRequest("gzip"));
  assert.equal(response, original);
  assert.equal(response.headers.get("content-encoding"), null);
  const reader = response.body.getReader();
  let timeout;
  try {
    const first = await Promise.race([
      reader.read(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("HTML shell waited for the tail")), 1000); }),
    ]);
    assert.equal(first.done, false);
    assert.deepEqual(first.value, shell);
    source.enqueue(tail); source.close();
    assert.deepEqual((await reader.read()).value, tail);
    assert.equal((await reader.read()).done, true);
  } finally { clearTimeout(timeout); await reader.cancel(); }
});

test("both verified prerender and cache HIT markers are required", async () => {
  for (const extra of [
    { "x-nextjs-prerender": "" }, { "x-opennext-cache": "" },
    { "x-nextjs-prerender": "0" }, { "x-opennext-cache": "MISS" },
    { "x-opennext-cache": "STALE" }, { "x-opennext-cache": "ERROR" },
  ]) {
    const original = publicHtml("shell", extra);
    assert.equal(compressHtml(original, compressionRequest("gzip")), original);
    assert.equal(await original.text(), "shell");
  }
});

test("identity variants vary; explicit gzip refusal overrides wildcard", async () => {
  for (const encoding of [null, "br", "gzip;q=0, *;q=1", "gzip;q=wat", "gzip;q=2"]) {
    const response = compressHtml(publicHtml(), compressionRequest(encoding));
    assert.equal(response.headers.get("content-encoding"), null, String(encoding));
    assert.equal(response.headers.get("vary"), "Accept-Encoding");
    assert.match(await response.text(), /same document/);
  }
  for (const encoding of ["*;q=0.5", "GZIP;q=0.1"]) {
    const response = compressHtml(publicHtml(), compressionRequest(encoding));
    assert.equal(response.headers.get("content-encoding"), "gzip");
    await response.arrayBuffer();
  }
});

test("private, authenticated, partial, non-HTML and already encoded responses bypass compression", () => {
  for (const extra of [{ "set-cookie": "session=x" }, { "cache-control": "private, s-maxage=60" },
    { "cache-control": 'public, private="Set-Cookie", s-maxage=60' }, { "cache-control": 'public, no-cache="X-User"' },
    { "cache-control": "no-store, public" }, { "cache-control": "no-cache, public" },
    { "cache-control": "max-age=0" }, { "content-encoding": "br" }, { "content-range": "bytes 0-10/20" },
    { "content-type": "text/x-component" }]) {
    const response = publicHtml("test", extra);
    assert.equal(compressHtml(response, compressionRequest("gzip")), response);
  }
  for (const extra of [{ cookie: "session=x" }, { authorization: "Bearer x" }]) {
    const response = publicHtml();
    assert.equal(compressHtml(response, compressionRequest("gzip", extra)), response);
  }
  for (const status of [206, 401, 500]) {
    const response = new Response("test", { status, headers: { "content-type": "text/html", "cache-control": "public" } });
    assert.equal(compressHtml(response, compressionRequest("gzip")), response);
  }
  const response = publicHtml();
  assert.equal(compressHtml(response, new Request("https://example.com", { method: "HEAD" })), response);
});

test("encoded metadata is corrected and existing Vary dimensions survive", async () => {
  const response = compressHtml(publicHtml("abc", { "content-length": "3", "etag": '"original"', "digest": "obsolete", "content-digest": "obsolete", "repr-digest": "obsolete", "vary": "RSC, Accept-Encoding" }), compressionRequest("gzip"));
  assert.equal(response.headers.get("etag"), 'W/"original"');
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(response.headers.get("digest"), null);
  assert.equal(response.headers.get("content-digest"), null);
  assert.equal(response.headers.get("repr-digest"), null);
  assert.equal(response.headers.get("vary"), "RSC, Accept-Encoding");
  await response.arrayBuffer();
});

test("Cloudflare original client negotiation overrides normalized encoding", async () => {
  const request = compressionRequest("br, gzip");
  Object.defineProperty(request, "cf", { value: { clientAcceptEncoding: "identity, gzip;q=0" } });
  const response = compressHtml(publicHtml(), request);
  assert.equal(response.headers.get("content-encoding"), null);
  await response.text();
});
