// What a service worker keys its caches on.
//
// This exists because the obvious answer is wrong in a way that takes weeks to
// notice. A worker deletes every cache whose name does not start with its
// version, and serves precached paths cache-first, so the version is the only
// thing that makes a deploy reach a device that has already visited. Key it on
// the app's release number and you have swapped "somebody forgot to bump the
// string in sw.js" for "somebody forgot to bump package.json", which is the
// same bug with an extra step: all four apps here are still on 0.1.0.
//
// So the commit is what it keys on, because a deploy that changed nothing is
// not a deploy. Vercel sets it on every build and the repo already reads it in
// each app's app-info. The release number is the fallback for a build with no
// commit behind it, which in practice means a local production build, where the
// worker is not registered anyway.
//
// Eight characters is git's own abbreviation length at this repo size, and the
// string is a cache key rather than anything a person reads.

/**
 * The cache key prefix for one site's worker.
 *
 * @param app A short stable name for the site, so two of them on one origin
 *   during a subdomain migration cannot delete each other's caches.
 */
export function workerVersion(app: string, release: string, commit: string | null): string {
  return commit ? `${app}-${commit.slice(0, 8)}` : `${app}-v${release}`;
}
