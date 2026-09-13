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

/** OpenNext owns worker.js; generate a separate entry point after its build completes. */
export function writeHtmlPolicyWorker(app, publishSource = false) {
  accessSync(join(app, ".open-next/worker.js"));
  writeFileSync(join(app, ".open-next/worker-no-transform.js"), `import worker from "./worker.js";
export * from "./worker.js";
${protectHtml.toString()}
export default {
  ...worker,
  async fetch(...args) {
    return protectHtml(await worker.fetch(...args));
  },
};
`);
  if (publishSource) {
    const assets = join(app, ".open-next/assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, "runtime-policy.mjs"), readFileSync(new URL(import.meta.url)));
  }
}
