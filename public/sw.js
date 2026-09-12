// The service worker, kept as small as the site it serves.
//
// Two jobs, and it refuses a third. It makes the site installable, because a
// browser will not offer to install a site that cannot answer a request while
// offline. And it makes immutable assets on a second visit paint from disk.
//
// What it deliberately does not do is cache HTML aggressively. A studio site
// that shows a stale games list is a site claiming a game exists that does not,
// which is the one failure this whole project is arranged against. So pages are
// network first and fall back to the cache only when the network fails; assets,
// which are content hashed and therefore immutable, are cache first.
//
// The Cloudflare build stamps this version with its build ID in the generated
// asset. A new deploy therefore replaces the worker and retires its old caches.

const VERSION = "v2";
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
      .then((keys) => Promise.all(keys.filter((key) => /^(shell|assets)-/.test(key) && key !== SHELL && key !== ASSETS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function cached(request) {
  return caches.match(request).catch(() => undefined);
}

function remember(event, name, response) {
  if (response.status !== 200) return;
  const copy = response.clone();
  // Offline storage is optional. Quota refusal must not reject the successful
  // network response, and the worker must stay alive until the write settles.
  event.waitUntil(
    caches.open(name).then((cache) => cache.put(event.request, copy)).catch(() => {}),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Next recovers a failed Flight request by navigating to its original URL.
  // Substituting homepage HTML instead would redirect that recovery home.
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;

  // Immutable by construction: Next content hashes these filenames, so a
  // changed file is a changed URL and a cached one can never be stale.
  const immutable = url.pathname.startsWith("/_next/static/");

  if (immutable) {
    event.respondWith(
      cached(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            remember(event, ASSETS, response);
            return response;
          }),
      ),
    );
    return;
  }

  // Pages and assets with stable names need the network first, including art.
  //
  // Only a 200 is written back. Caching whatever came down would store a 404
  // or a 500 under the URL of a page that exists, and then serve that stored
  // failure the next time the network is gone, which is worse than the plain
  // offline error it replaced.
  event.respondWith(
    fetch(request)
      .then((response) => {
        remember(event, SHELL, response);
        return response;
      })
      .catch(async () => {
        const hit = await cached(request);
        if (hit) return hit;
        if (request.mode === "navigate") return (await cached("/")) ?? Response.error();
        return Response.error();
      }),
  );
});
