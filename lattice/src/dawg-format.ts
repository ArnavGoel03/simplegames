// The studio's answer to the one import in the mirrored src/lib/pwa/offline-assets.ts
// that points outside the PWA bundle: `../../../lattice/src/dawg-format`, which
// resolves to this file. The games define Lattice's word lists there; the studio
// serves no word lists, so it lists none. That keeps every offline word-asset
// path, header and cache admission rule empty and inert here, while the mirrored
// files stay byte-identical to the game release (`sync-catalogue.mjs --check`).
// Only the names offline-assets.ts imports belong here; if the games import more,
// typecheck fails and this file grows to match.

/** No studio word lists, so no word-asset path is ever cached or admitted. */
export const LEXICON_IDS: readonly string[] = [];

/** Same transport type as the games, so the worker's type check reads identically. */
export const DAWG_CONTENT_TYPE = "application/octet-stream";

export function dawgAssetPath(id: string): string {
  return `/lattice/${id}.dawg`;
}

/** Static host headers for the word lists; none exist in the studio. */
export function dawgAssetHeaders(): string {
  return LEXICON_IDS.map((id) => `${dawgAssetPath(id)}\n  Content-Type: ${DAWG_CONTENT_TYPE}\n`).join("\n");
}
