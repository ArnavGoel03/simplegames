import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mirrorReadAloud } from "./read-aloud-mirror.mjs";
test("mirrors canonical reading bytes and detects a same-size content substitution", () => {
  const root = mkdtempSync(join(tmpdir(), "reading-mirror-"));
  try {
    const source = join(root, "source"), target = join(root, "target"); mkdirSync(source);
    writeFileSync(join(source, "read-aloud.ts"), "engine"); writeFileSync(join(source, "ReadAloud.tsx"), "control");
    mirrorReadAloud(source, target); mirrorReadAloud(source, target, true);
    assert.equal(readFileSync(join(target, "read-aloud.ts"), "utf8"), "engine");
    writeFileSync(join(target, "read-aloud.ts"), "ENGINE");
    assert.throws(() => mirrorReadAloud(source, target, true), /differs/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
