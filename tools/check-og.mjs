import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INPUTS, OUTPUTS, hashes } from "./og-receipt.mjs";
const receipt = JSON.parse(readFileSync(new URL("./og-assets-receipt.json", import.meta.url)));
assert.deepEqual(hashes(INPUTS), receipt.inputs, "Share-card input changed: run node tools/generate-og.mjs");
assert.deepEqual(hashes(OUTPUTS), receipt.outputs, "Share-card output changed: run node tools/generate-og.mjs");
console.log("Studio original share-card inputs and outputs verified");
