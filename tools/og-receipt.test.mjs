import { test } from "node:test";
import assert from "node:assert/strict";
import { hashes } from "./og-receipt.mjs";
test("source fingerprint changes when original renderer or brand changes", () => {
  const inputs = ["renderer.tsx", "brand.ts"];
  const original = hashes(inputs, () => Buffer.from("original"));
  assert.notDeepEqual(hashes(inputs, path => Buffer.from(path === "renderer.tsx" ? "changed" : "original")), original);
  assert.notDeepEqual(hashes(inputs, path => Buffer.from(path === "brand.ts" ? "changed" : "original")), original);
});
