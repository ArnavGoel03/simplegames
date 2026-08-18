// How the Next build is turned into a Cloudflare Worker.
//
// Every route here is prerendered, so the only thing this file has to get right
// is that they are served rather than rendered again. Without an incremental
// cache the adapter has nowhere to read a prerendered page from and the Worker
// runs the Next server on every request, which on a busy day is how a Worker
// meets the CPU ceiling its plan gives it and starts answering `Error 1102`
// instead of the page. The card site found that out with real players on it.
//
// The Worker's own static assets are the cache. Nothing here revalidates and
// nothing is written at runtime, which is exactly what that override is for.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // Answers a prerendered page without entering the Next server. Safe because
  // nothing here uses PPR, which is the one thing it must be off for.
  enableCacheInterception: true,
});
