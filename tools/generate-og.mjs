import React from "react";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";
import assert from "node:assert/strict";
import { INPUTS, OUTPUTS, hashes } from "./og-receipt.mjs";
const initial = hashes(INPUTS);
const generated = new URL("./.og-renderer.generated.mjs", import.meta.url);
try {
  await build({ entryPoints: [new URL("./og-renderers/studio.tsx", import.meta.url).pathname], outfile: generated.pathname,
    alias: { "next/og": "next/og.js" }, bundle: true, platform: "node", format: "esm", packages: "external", tsconfig: new URL("../tsconfig.json", import.meta.url).pathname });
  Object.assign(globalThis, { React });
  const renderer = await import(generated.href);
  const bytes = Buffer.from(await renderer.default().arrayBuffer());
  assert.equal(bytes.readUInt32BE(0), 0x89504e47);
  assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
  writeFileSync(new URL("../src/app/opengraph-image.png", import.meta.url), bytes);
  writeFileSync(new URL("../src/app/opengraph-image.alt.txt", import.meta.url), renderer.alt);
  assert.deepEqual(hashes(INPUTS), initial, "Image inputs changed during generation");
  writeFileSync(new URL("./og-assets-receipt.json", import.meta.url), JSON.stringify({ schema: 1, inputs: initial, outputs: hashes(OUTPUTS) }, null, 2) + "\n");
  console.log(`studio original share card: ${bytes.length} PNG bytes`);
} finally { try { unlinkSync(generated); } catch {} }
