// Studio-specific inputs for the unchanged studio-wide release engine.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceFingerprint } from "./build-state.mjs";
import { SITE_URL } from "./site-url.mjs";
import { digest, readJson, sourceHead } from "./quality/quality-runtime.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const gateCommand = ["npm", "run", "gate"];
export const policy = () => readJson(join(root, "tools/release-policy.json"));
export const identity = () => ({ sourceHead: sourceHead(root), sourceFingerprint: sourceFingerprint(root, SITE_URL) });
export const buildSource = () => digest(JSON.stringify(identity()));
export function workerName() {
  const name = readFileSync(join(root, "wrangler.jsonc"), "utf8").match(/"name"\s*:\s*"([^"]+)"/)?.[1];
  if (!name) throw new Error("release: missing studio Worker identity");
  return name;
}
export const previewOrigin = (version) => `https://${version?.slice(0, 8)}-${workerName()}.goelhome.workers.dev`;
