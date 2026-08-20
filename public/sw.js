// The service worker, kept as small as the site it serves.
//
// Two jobs, and it refuses a third. It makes the site installable, because a
// browser will not offer to install a site that cannot answer a request while
// offline. And it makes a second visit paint from disk, because every page
// here is prerendered and none of it changes between deploys, so asking the
// network first is a round trip spent confirming what is already correct.
//
// What it deliberately does not do is cache HTML aggressively. A studio site
// that shows a stale games list is a site claiming a game exists that does not,
// which is the one failure this whole project is arranged against. So pages are
// network first and fall back to the cache only when the network fails; assets,
// which are content hashed and therefore immutable, are cache first.
//
// The version string is what retires an old cache. Bump it and every client
// drops the previous one on its next visit.

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

// Enough to render something recognisable with no network at all.
// The four game sites have an /offline route; this one does not, so the home
// page is the fallback. Precaching a path that 404s would leave the offline
// answer empty while looking configured.
const PRECACHE = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Individually rather than addAll, because addAll rejects the whole
      // install if any single request 404s, and an install that fails silently
      // leaves the site uninstallable with no error anybody sees.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable by construction: Next content hashes these filenames, so a
  // changed file is a changed URL and a cached one can never be stale.
  const immutable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/art/");

  if (immutable) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else, which is pages: the network is the truth, the cache is the
  // fallback for when there is no network.
  //
  // Only a 200 is written back. Caching whatever came down would store a 404
  // or a 500 under the URL of a page that exists, and then serve that stored
  // failure the next time the network is gone, which is worse than the plain
  // offline error it replaced.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
  );
});
