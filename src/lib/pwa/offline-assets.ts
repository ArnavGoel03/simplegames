import { DAWG_CONTENT_TYPE, LEXICON_IDS, dawgAssetHeaders, dawgAssetPath } from "../../../lattice/src/dawg-format";

/** Only these public binaries may join the build's hashed client assets. */
export const OFFLINE_WORD_ASSET_PATHS = LEXICON_IDS.map(dawgAssetPath);
export { DAWG_CONTENT_TYPE };
export const OFFLINE_WORD_ASSET_HEADERS = dawgAssetHeaders();

export const OFFLINE_ASSET_MANIFEST_PATH = "/offline-assets.json";
/** Retained original licences must remain accessible with the downloaded code. */
export const OFFLINE_NOTICES_PATH = "/third-party-notices.txt";
export const OFFLINE_ASSET_MANIFEST_FORMAT = 1;
/** Same bounds for build discovery and the worker's public asset download. */
export const OFFLINE_ASSET_LIMIT = 128;
export const OFFLINE_ASSET_TOTAL_BYTES = 16 * 1024 * 1024;
export const OFFLINE_ASSET_FILE_BYTES = 2 * 1024 * 1024;

export interface OfflineAssetManifest {
  readonly version: typeof OFFLINE_ASSET_MANIFEST_FORMAT;
  readonly release: string;
  readonly assets: readonly { path: string; sha256: string; bytes: number }[];
}
