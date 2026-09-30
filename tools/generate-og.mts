import React from "react";
import { writeFileSync } from "node:fs";
Object.assign(globalThis, { React });
const renderer = await import("./og-renderers/studio");
const bytes = Buffer.from(await renderer.default().arrayBuffer());
if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error("renderer did not return PNG");
writeFileSync("src/app/opengraph-image.png", bytes);
writeFileSync("src/app/opengraph-image.alt.txt", renderer.alt);
console.log(`studio original share card: ${bytes.length} PNG bytes`);
