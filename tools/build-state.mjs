// A successful upload must correspond to the source and origin being shipped.
// The marker lives with generated output, so a failed rebuild cannot certify it.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STAMP = ".open-next/build-state.json";
const WORKER = ".open-next/assets/sw.js";
const VERSION = /const VERSION = "([^"]+)";/;
const ENTRIES = [".open-next/worker.js", ".open-next/worker-no-transform.js"];

export function outputFingerprint(root) {
  const hash = createHash("sha256");
  for (const path of ENTRIES) if (!existsSync(join(root, path))) throw new Error(`cf: incomplete generated entry ${path}`);
  function read(path) {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`;
      if (child === STAMP) continue;
      if (entry.isDirectory()) read(child);
      else hash.update(child).update("\0").update(readFileSync(join(root, child))).update("\0");
    }
  }
  read(".open-next");
  hash.update(".next/BUILD_ID").update(readFileSync(join(root, ".next/BUILD_ID")));
  return hash.digest("hex");
}
const SOURCE_DIRECTORIES = ["src", "public", "tools", "docs/quality", ".github"];
const GENERATED = new Set(["node_modules", ".audit", ".git", ".next", ".open-next", ".wrangler", ".vercel", "coverage", "dist", "test-results", "playwright-report", ".DS_Store"]);
const generated = (name) => GENERATED.has(name) || name.endsWith(".tsbuildinfo") || name === "next-env.d.ts";

// Personal instructions and an inactive package-manager lock are local metadata
// only while untracked. Tracked project versions still belong to the certificate.
const LOCAL_ROOT_METADATA = ["AGENTS.md", "CLAUDE.md", "pnpm-lock.yaml"];
function untrackedLocalMetadata(root) {
  // Fixtures without their own Git index retain source discovery semantics.
  if (!existsSync(join(root, ".git"))) return new Set();
  try {
    const tracked = new Set(execFileSync("git", ["ls-files", "-z", "--", ...LOCAL_ROOT_METADATA],
      { cwd: root, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).split("\0"));
    return new Set(LOCAL_ROOT_METADATA.filter(name => !tracked.has(name)));
  } catch { return new Set(); }
}

export function sourceFingerprint(root, origin) {
  const publicEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("NEXT_PUBLIC_")).sort(([a], [b]) => a.localeCompare(b)));
  const hash = createHash("sha256").update(JSON.stringify({ origin, publicEnv }));
  function read(path) {
    const fullPath = join(root, path);
    const entries = readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (generated(entry.name)) continue;
      const child = `${path}/${entry.name}`;
      // Generated from src/lib/pwa and build attribution; output hashes cover it.
      if (child === "public/sw.js") continue;
      if (entry.isDirectory()) read(child);
      else hash.update(child).update("\0").update(readFileSync(join(root, child))).update("\0");
    }
  }
  // Discover root files so a new compiler, environment or gate config is covered.
  const localMetadata = untrackedLocalMetadata(root);
  const files = readdirSync(root, { withFileTypes: true }).filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && !generated(entry.name) && !localMetadata.has(entry.name)).map((entry) => entry.name);
  for (const path of [...SOURCE_DIRECTORIES, ...files].sort()) {
    if (!existsSync(join(root, path))) continue;
    if (SOURCE_DIRECTORIES.includes(path)) read(path);
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
  writeFileSync(join(root, STAMP), JSON.stringify({ fingerprint, buildId, outputHash: outputFingerprint(root) }));
}

export function verifyBuild(root, fingerprint) {
  const rebuild = "Run npm run cf:build before deploying or previewing.";
  if (!existsSync(join(root, STAMP))) throw new Error(`cf: no verified build. ${rebuild}`);
  const stamp = JSON.parse(readFileSync(join(root, STAMP), "utf8"));
  if (stamp.fingerprint !== fingerprint) throw new Error(`cf: source or canonical origin changed since the build. ${rebuild}`);
  const buildId = readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim();
  if (stamp.buildId !== buildId || stamp.outputHash !== outputFingerprint(root)) {
    throw new Error(`cf: generated build was replaced or is incomplete. ${rebuild}`);
  }
  return stamp;
}
