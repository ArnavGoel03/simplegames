// A successful upload must correspond to the source and origin being shipped.
// The marker lives with generated output, so a failed rebuild cannot certify it.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STAMP = ".open-next/build-state.json";
const WORKER = ".open-next/assets/sw.js";
const VERSION = /const VERSION = "([^"]+)";/;
const ENTRIES = [".open-next/worker.js", ".open-next/worker-no-transform.js"];

function entryHash(root) {
  const hash = createHash("sha256");
  for (const path of ENTRIES) hash.update(path).update(readFileSync(join(root, path)));
  return hash.digest("hex");
}
const INPUTS = [
  "src", "public", "tools", "next.config.ts", "open-next.config.ts", "wrangler.jsonc",
  "tsconfig.json", "package.json", "package-lock.json", "pnpm-lock.yaml", ".npmrc",
  ".env", ".env.local", ".env.production", ".env.production.local",
];

export function sourceFingerprint(root, origin) {
  const hash = createHash("sha256").update(JSON.stringify({ origin }));
  function read(path) {
    const fullPath = join(root, path);
    const entries = readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) read(child);
      else hash.update(child).update("\0").update(readFileSync(join(root, child))).update("\0");
    }
  }
  for (const path of INPUTS) {
    if (!existsSync(join(root, path))) continue;
    if (["src", "public", "tools"].includes(path)) read(path);
    else hash.update(path).update("\0").update(readFileSync(join(root, path))).update("\0");
  }
  return hash.digest("hex");
}

export function invalidateBuild(root) {
  rmSync(join(root, STAMP), { force: true });
}

export function stampBuild(root, fingerprint) {
  const buildId = readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim();
  if (!buildId) throw new Error("cf: build has no Next build ID");
  const path = join(root, WORKER);
  const worker = readFileSync(path, "utf8");
  const version = worker.match(VERSION)?.[1];
  if (!version) throw new Error("cf: generated service worker has no cache version");
  const stamped = worker.replace(VERSION, `const VERSION = ${JSON.stringify(`${version}-${buildId}`)};`);
  writeFileSync(path, stamped);
  writeFileSync(join(root, STAMP), JSON.stringify({ fingerprint, buildId, entryHash: entryHash(root), workerHash: createHash("sha256").update(stamped).digest("hex") }));
}

export function verifyBuild(root, fingerprint) {
  const rebuild = "Run npm run cf:build before deploying or previewing.";
  if (!existsSync(join(root, STAMP))) throw new Error(`cf: no verified build. ${rebuild}`);
  const stamp = JSON.parse(readFileSync(join(root, STAMP), "utf8"));
  if (stamp.fingerprint !== fingerprint) throw new Error(`cf: source or canonical origin changed since the build. ${rebuild}`);
  const buildId = readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim();
  const workerHash = createHash("sha256").update(readFileSync(join(root, WORKER))).digest("hex");
  if (stamp.buildId !== buildId || stamp.workerHash !== workerHash || stamp.entryHash !== entryHash(root)) {
    throw new Error(`cf: generated build was replaced or is incomplete. ${rebuild}`);
  }
}
