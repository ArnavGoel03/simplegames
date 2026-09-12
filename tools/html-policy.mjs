import { accessSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Keep intermediaries from injecting scripts into HTML without changing its cache policy. */
export function protectHtml(response) {
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/html") return response;
  const cache = response.headers.get("cache-control");
  if (cache?.split(",").some((directive) => directive.trim().toLowerCase() === "no-transform")) return response;
  const protectedResponse = new Response(response.body, response);
  protectedResponse.headers.set("cache-control", cache ? `${cache}, no-transform` : "no-transform");
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
