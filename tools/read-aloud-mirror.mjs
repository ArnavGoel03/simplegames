import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["read-aloud.ts", "ReadAloud.tsx"];
export function mirrorReadAloud(source, target, check = false) {
  const files = FILES.map(name => ({ name, bytes: readFileSync(join(source, name)) }));
  for (const file of files) assert(file.bytes.length > 0 && file.bytes.length <= 50000, "Invalid reading source");
  const receipt = JSON.stringify({ schema: 1, files: files.map(file => ({ name: file.name,
    sha256: createHash("sha256").update(file.bytes).digest("hex") })) }, null, 2) + "\n";
  if (check) {
    for (const file of files) assert(readFileSync(join(target, file.name)).equals(file.bytes), `Reading mirror differs: ${file.name}`);
    assert.equal(readFileSync(join(target, "release.json"), "utf8"), receipt);
  } else {
    mkdirSync(target, { recursive: true });
    for (const file of files) writeFileSync(join(target, file.name), file.bytes);
    writeFileSync(join(target, "release.json"), receipt);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  assert(source, "Pass the canonical packages/studio/src/site directory");
  mirrorReadAloud(source, resolve("src/lib/read-aloud"), process.argv.includes("--check"));
}
