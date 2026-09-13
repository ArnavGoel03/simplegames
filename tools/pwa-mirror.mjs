import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PWA_FILES = ["service-worker.ts", "worker-runtime.ts", "version.ts", "asset-recovery.ts", "worker-client.ts", "early-source.ts", "diagnostic-limits.ts"];

export function validatePwaSource(bundle) {
  assert(bundle && bundle.schema === 1 && Array.isArray(bundle.files), "Unsupported PWA source bundle");
  assert.equal(bundle.files.length, PWA_FILES.length, "Incomplete PWA source bundle");
  const names = new Set();
  for (const file of bundle.files) {
    assert(file && PWA_FILES.includes(file.name) && !names.has(file.name), "Unexpected or duplicate PWA filename");
    names.add(file.name);
    assert(typeof file.source === "string" && file.source.length > 0 && Buffer.byteLength(file.source) <= 200000, "Invalid PWA source size");
    assert(typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256), "Invalid PWA source hash");
    assert.equal(createHash("sha256").update(file.source).digest("hex"), file.sha256, `PWA hash mismatch: ${file.name}`);
  }
  return [...bundle.files].sort((a, b) => PWA_FILES.indexOf(a.name) - PWA_FILES.indexOf(b.name));
}

export function mirrorPwaSource(bundle, directory, check = false) {
  const files = validatePwaSource(bundle);
  const receipt = JSON.stringify({ schema: 1, files: files.map(({ name, sha256 }) => ({ name, sha256 })) }, null, 2) + "\n";
  if (check) {
    for (const file of files) assert.equal(readFileSync(join(directory, file.name), "utf8"), file.source, `PWA source differs from the game release: ${file.name}`);
    assert.equal(readFileSync(join(directory, "release.json"), "utf8"), receipt, "PWA source receipt differs");
  } else {
    mkdirSync(directory, { recursive: true });
    for (const file of files) writeFileSync(join(directory, file.name), file.source);
    writeFileSync(join(directory, "release.json"), receipt);
  }
}
