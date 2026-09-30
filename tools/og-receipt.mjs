import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export const INPUTS = ["tools/generate-og.mjs", "tools/og-receipt.mjs", "tools/og-renderers/studio.tsx", "src/lib/brand.ts", "src/lib/studio-mark.ts", "src/lib/studio-mark.json", "src/lib/palette.json", "package-lock.json"];
export const OUTPUTS = ["src/app/opengraph-image.png", "src/app/opengraph-image.alt.txt"];
export const hashes = (paths, read = path => readFileSync(new URL(`../${path}`, import.meta.url))) => Object.fromEntries(paths.map(path => [path, createHash("sha256").update(read(path)).digest("hex")]));
