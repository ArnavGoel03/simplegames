// Where this site answers, read from the one file that decides it.
//
// `src/lib/brand.ts` owns the canonical origin: every canonical tag, share
// card, sitemap entry and robots line is built from `resolveUrl()`. The build
// wrapper and the IndexNow submitter need the same value, and node cannot
// import a TypeScript module without a loader, so this reads the literal out
// of that file rather than keeping a second copy of it that can disagree.
// `cf.mjs` held such a copy until this file existed.
//
// One way flow: brand.ts is the source, this reads it, nothing writes back.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BRAND = fileURLToPath(new URL("../src/lib/brand.ts", import.meta.url));
const FALLBACK = /function resolveUrl\(\)[\s\S]*?return "(https:\/\/[^"]+)";/;

function readCanonicalOrigin() {
  const source = readFileSync(BRAND, "utf8");
  const found = source.match(FALLBACK);
  if (!found) {
    // A rename or a refactor of resolveUrl lands here rather than silently
    // shipping some other address.
    throw new Error(`site-url: no canonical origin found in ${BRAND}`);
  }
  return found[1];
}

/** The origin this build targets. An explicit environment value wins. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || readCanonicalOrigin();
