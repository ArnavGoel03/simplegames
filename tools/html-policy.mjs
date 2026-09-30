import { accessSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Revalidate browser documents while preserving shared and private cache policy. */
export function protectHtml(response) {
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/html") return response;
  const directives = (response.headers.get("cache-control") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  // Hashed assets can disappear on a deploy. A browser must not reuse an old
  // document during stale-while-revalidate and then request those removed files.
  const kept = directives.filter((value) => !/^(?:stale-while-revalidate|stale-if-error)\s*=/i.test(value))
    .map((value) => /^max-age\s*=/i.test(value) ? "max-age=0" : value);
  const has = (name) => kept.some((value) => value.toLowerCase() === name);
  if (!has("no-store") && !has("no-cache")) {
    if (!kept.some((value) => /^max-age\s*=/i.test(value))) kept.push("max-age=0");
    if (!has("must-revalidate")) kept.push("must-revalidate");
  }
  if (!has("no-transform")) kept.push("no-transform");
  const cache = kept.join(", ");
  if (response.headers.get("cache-control") === cache) return response;
  const protectedResponse = new Response(response.body, response);
  protectedResponse.headers.set("cache-control", cache);
  return protectedResponse;
}

/** Compress cached prerenders without buffering a live HTML shell behind gzip. */
export function compressHtml(response, request) {
  const cache = response.headers.get("cache-control") ?? "";
  if (request.method !== "GET" || response.status !== 200 || !response.body ||
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/html" ||
      response.headers.get("x-nextjs-prerender") !== "1" || response.headers.get("x-opennext-cache") !== "HIT" ||
      response.headers.has("content-encoding") || response.headers.has("content-range") ||
      response.headers.has("set-cookie") || request.headers.has("authorization") || request.headers.has("cookie") || request.headers.has("range") ||
      /(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|=|,|$)/i.test(cache) ||
      !/(?:^|,)\s*(?:public(?:\s|,|$)|s-maxage\s*=\s*[1-9]\d*)/i.test(cache)) return response;
  const headers = new Headers(response.headers);
  const vary = (headers.get("vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!vary.some((value) => value === "*" || value.toLowerCase() === "accept-encoding")) vary.push("Accept-Encoding");
  headers.set("vary", vary.join(", "));
  // Cloudflare normalizes the ordinary header; cf retains the client's negotiation.
  const encodings = (request.cf?.clientAcceptEncoding ?? request.headers.get("accept-encoding") ?? "").toLowerCase().split(",").map((entry) => {
    const [name, ...parameters] = entry.trim().split(";");
    const quality = parameters.find((value) => value.trim().startsWith("q="));
    const q = quality ? Number(quality.trim().slice(2)) : 1;
    return { name: name.trim(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  const gzip = encodings.find((entry) => entry.name === "gzip") ?? encodings.find((entry) => entry.name === "*");
  if (!gzip || gzip.q === 0) return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  headers.set("content-encoding", "gzip");
  for (const name of ["content-length", "content-md5", "digest", "content-digest", "repr-digest", "accept-ranges"]) headers.delete(name);
  const etag = headers.get("etag");
  if (etag && !etag.startsWith("W/")) headers.set("etag", `W/${etag}`);
  // Workers must send these already encoded bytes without a second compression pass.
  return new Response(response.body.pipeThrough(new CompressionStream("gzip")), {
    status: response.status, statusText: response.statusText, headers, encodeBody: "manual",
  });
}

/** OpenNext owns worker.js; generate a separate entry point after its build completes. */
export function writeHtmlPolicyWorker(app, publishSource = false) {
  accessSync(join(app, ".open-next/worker.js"));
  writeFileSync(join(app, ".open-next/worker-no-transform.js"), `import worker from "./worker.js";
export * from "./worker.js";
${protectHtml.toString()}
${compressHtml.toString()}
export default {
  ...worker,
  async fetch(...args) {
    return compressHtml(protectHtml(await worker.fetch(...args)), args[0]);
  },
};
`);
  if (publishSource) {
    const assets = join(app, ".open-next/assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, "runtime-policy.mjs"), readFileSync(new URL(import.meta.url)));
  }
}
