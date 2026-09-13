// Executed as generated worker JavaScript. Keep browser globals inside the
// string so importing the route on the server does not touch worker APIs.
export const WORKER_RUNTIME = String.raw`
// Three generations protect recently restored documents without retaining
// every release forever. Each cache is also bounded by count and decoded bytes.
const MAX_GENERATIONS = 3;
const MAX_ENTRIES = 256;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_DEPENDENCIES = 128;
const SIZE_HEADER = "x-gtg-cache-bytes";
const DEPS_HEADER = "x-gtg-cache-dependencies";
let writes = Promise.resolve();
const emitWorkerFault = (code, details = {}) => typeof reportOperationalFault === "function" ? reportOperationalFault(code, { operation: "pwa", ...details }) : Promise.resolve();

function ownedCache(name) {
  if (!name.startsWith(CACHE_PREFIX) || !name.endsWith("-static")) return false;
  return /^(?:[a-f0-9]{8}|v[0-9][a-z0-9.+-]*)$/i.test(name.slice(CACHE_PREFIX.length, -7));
}

function isPrivate(pathname) {
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function assetUrl(value, base = self.location.origin) {
  const url = new URL(value, base);
  return url.origin === self.location.origin && !url.search &&
    url.pathname.startsWith("/_next/static/") ? url : null;
}

function validResponse(response, url) {
  if (!response || !response.ok || response.status === 206 || response.redirected) return false;
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const path = new URL(url, self.location.origin).pathname;
  if (path.endsWith(".css")) return type === "text/css";
  if (/\.m?js$/.test(path)) return ["text/javascript", "application/javascript", "application/x-javascript"].includes(type);
  if (/\.(woff2?|ttf|otf)$/.test(path)) return type.startsWith("font/") || type.startsWith("application/font") || type === "application/octet-stream";
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/.test(path)) return type.startsWith("image/");
  if (path.endsWith(".wasm")) return type === "application/wasm";
  if (path.endsWith(".json") || path.endsWith(".webmanifest")) return type === "application/json" || type === "application/manifest+json";
  // Hashed assets must never be an HTML error page with a successful status.
  return !assetUrl(url) && type !== "text/x-component" && type !== "";
}

async function limitedBody(response) {
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => {});
        throw new Error("offline asset exceeds cache limit");
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function trimCache(cache) {
  const keys = await cache.keys();
  let bytes = 0;
  let entries = 0;
  // Cache insertion order makes the oldest entries the first to go.
  for (const key of keys.reverse()) {
    const response = await cache.match(key);
    if (!response) continue;
    let size = Number(response.headers.get(SIZE_HEADER));
    if (!response.headers.has(SIZE_HEADER)) {
      try { size = (await limitedBody(response.clone())).byteLength; }
      catch { size = MAX_RESPONSE_BYTES + 1; }
    }
    if (!response.ok || !Number.isFinite(size) || size < 0 || size > MAX_RESPONSE_BYTES ||
        entries >= MAX_ENTRIES || bytes + size > MAX_CACHE_BYTES) {
      await cache.delete(key);
    } else {
      bytes += size;
      entries++;
    }
  }
}

async function store(request, response, dependencies) {
  const body = await limitedBody(response);
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.set(SIZE_HEADER, String(body.byteLength));
  if (dependencies) headers.set(DEPS_HEADER, JSON.stringify(dependencies));
  else headers.delete(DEPS_HEADER);
  const saved = new Response(body, { status: response.status, statusText: response.statusText, headers });
  // Concurrent fetches cannot all observe room below the cap and overfill it.
  const work = writes.then(async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.delete(request);
    await cache.put(request, saved);
    await trimCache(cache);
  });
  writes = work.catch(() => {});
  return work;
}

async function cacheNames(immutable) {
  if (!immutable) return [STATIC_CACHE];
  const previous = (await caches.keys()).filter((name) => ownedCache(name) && name !== STATIC_CACHE).reverse();
  return [STATIC_CACHE, ...previous.slice(0, MAX_GENERATIONS - 1)];
}

async function savedResponse(request, immutable = false) {
  try {
    for (const name of await cacheNames(immutable)) {
      const cache = await caches.open(name);
      const hit = await cache.match(request);
      if (!hit) continue;
      if (validResponse(hit, typeof request === "string" ? request : request.url)) return hit;
      await cache.delete(request);
    }
  } catch { /* Storage eviction must not block the network. */ }
  return null;
}

function attribute(tag, name) {
  return tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"))?.[2].replace(/&amp;/g, "&");
}

function documentAssets(html, base) {
  const dependencies = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    const script = /^<script\b/i.test(tag);
    const rel = attribute(tag, "rel");
    const required = script || rel === "stylesheet" || rel === "modulepreload" ||
      (rel === "preload" && ["script", "style", "font"].includes(attribute(tag, "as")));
    if (!required) continue;
    const value = attribute(tag, script ? "src" : "href");
    if (!value) continue;
    const url = assetUrl(value, base);
    if (!url) throw new Error("offline dependency is not a versioned local asset");
    dependencies.add(url.href);
  }
  if (dependencies.size > MAX_DEPENDENCIES) throw new Error("too many offline dependencies");
  return dependencies;
}

function styleAssets(css, base) {
  const dependencies = new Set();
  for (const match of css.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi)) {
    const value = match[2].trim();
    if (value.startsWith("data:") || value.startsWith("#")) continue;
    const url = assetUrl(value, base);
    if (!url) throw new Error("offline stylesheet dependency is not versioned locally");
    dependencies.add(url.href);
  }
  // Next emits bundled styles. Do not call an unbundled import a complete shell.
  if (/@import\s/i.test(css)) throw new Error("unbundled offline stylesheet");
  return dependencies;
}

async function preload() {
  const pending = new Map();
  async function asset(url, ancestors = new Set()) {
    if (ancestors.has(url)) return [];
    if (pending.has(url)) return pending.get(url);
    if (pending.size >= MAX_ENTRIES) throw new Error("too many offline assets");
    const next = new Set([...ancestors, url]);
    const work = (async () => {
      const response = await savedResponse(url, true) || await fetch(url, {
        cache: "reload", credentials: "omit", signal: AbortSignal.timeout(10000),
      });
      if (!validResponse(response, url)) throw new Error("offline asset unavailable");
      const nested = new Set();
      if (new URL(url).pathname.endsWith(".css")) {
        const css = new TextDecoder().decode(await limitedBody(response.clone()));
        for (const dependency of styleAssets(css, url)) {
          nested.add(dependency);
          for (const child of await asset(dependency, next)) nested.add(child);
        }
      }
      // Copy reused immutable assets into this generation before older caches
      // can be pruned during activation.
      await store(url, response.clone());
      return [...nested];
    })();
    pending.set(url, work);
    return work;
  }

  // Bound concurrent document downloads. Failed shells are never published,
  // but they must not prevent a fixed worker replacing an already broken one.
  const urls = [...new Set([...PRECACHE, START_URL])].filter((value) => {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && !isPrivate(url.pathname) && url.pathname !== ESCAPE;
  });
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (index < urls.length) {
      const path = urls[index++];
      try {
        const response = await fetch(path, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(10000) });
        if (!validResponse(response, path)) { void emitWorkerFault("pwa-precache", { status: response.status }); continue; }
        if (response.headers.get("content-type")?.split(";")[0].trim() !== "text/html") {
          await store(path, response.clone());
          continue;
        }
        const html = new TextDecoder().decode(await limitedBody(response.clone()));
        const dependencies = documentAssets(html, new URL(path, self.location.origin).href);
        for (const url of [...dependencies]) {
          for (const child of await asset(url)) dependencies.add(child);
          if (dependencies.size > MAX_DEPENDENCIES) throw new Error("too many offline dependencies");
        }
        await store(path, response.clone(), [...dependencies]);
      } catch (error) { void emitWorkerFault("pwa-precache", { errorType: error?.name }); }
    }
  }));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(preload().catch(() => {}));
});

async function migrateLegacy() {
  if (!LEGACY_CACHE_PREFIXES.length) return;
  const names = (await caches.keys()).filter((name) => !ownedCache(name));
  const legacy = new Set();
  const retained = new Set();
  for (const prefix of LEGACY_CACHE_PREFIXES) {
    const matching = names.filter((name) => name.startsWith(prefix));
    for (const name of matching) legacy.add(name);
    for (const name of matching.slice(-(MAX_GENERATIONS - 1))) retained.add(name);
  }
  for (const name of retained) {
    const cache = await caches.open(name);
    for (const request of (await cache.keys()).slice(-MAX_ENTRIES)) {
      if (!assetUrl(request.url)) continue;
      const response = await cache.match(request);
      if (validResponse(response, request.url)) await store(request, response).catch(() => {});
    }
  }
  // Only explicitly supplied legacy namespaces belong to this migration.
  for (const name of legacy) await caches.delete(name);
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await migrateLegacy();
      const previous = (await caches.keys()).filter((name) => ownedCache(name) && name !== STATIC_CACHE);
      for (const name of previous.slice(0, -(MAX_GENERATIONS - 1))) await caches.delete(name);
      for (const name of [STATIC_CACHE, ...previous.slice(-(MAX_GENERATIONS - 1))]) {
        await trimCache(await caches.open(name));
      }
    } catch (error) { void emitWorkerFault("pwa-cache-write", { errorType: error?.name }); }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

async function savedDocument(request) {
  const hit = await savedResponse(request);
  if (!hit || hit.headers.get("content-type")?.split(";")[0].trim() !== "text/html") return null;
  try {
    const dependencies = JSON.parse(hit.headers.get(DEPS_HEADER) || "null");
    if (!Array.isArray(dependencies) || dependencies.length > MAX_DEPENDENCIES) return null;
    for (const url of dependencies) {
      if (typeof url !== "string" || !assetUrl(url) || !await savedResponse(url, true)) {
        void emitWorkerFault("pwa-offline-incomplete");
        return null;
      }
    }
    return hit;
  } catch { return null; }
}

async function offlineAnswer(request) {
  const url = new URL(request.url);
  return await savedDocument(request) || await savedDocument(url.pathname) ||
    await savedDocument(OFFLINE) || lastResort();
}

async function recoverStylesheet(event, response) {
  const request = event.request;
  if (!event.clientId || self.navigator.onLine === false || request.destination !== "style" ||
      !new URL(request.url).pathname.endsWith(".css") ||
      !(response.status === 404 || response.status === 410 || (response.status === 200 && !validResponse(response, request.url)))) return;
  const client = await self.clients.get(event.clientId);
  if (!client || typeof client.navigate !== "function") return;
  const target = new URL(client.url);
  if (target.origin !== self.location.origin || target.pathname === ESCAPE || target.searchParams.has(ASSET_RECOVERY_QUERY)) return;
  // Client IDs change on navigation. A per-route/build receipt survives that
  // change and worker termination, without storing room IDs in cache keys.
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(target.pathname + target.search)));
  const key = self.location.origin + "/_pwa/recovery/" + [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const reserve = writes.then(async () => {
    const cache = await caches.open(STATIC_CACHE);
    if (await cache.match(key)) return false;
    await cache.put(key, new Response("1", { headers: { [SIZE_HEADER]: "1", "content-type": "text/plain" } }));
    await trimCache(cache);
    return true;
  });
  writes = reserve.then(() => {}, () => {});
  if (!await reserve) return;
  const reporting = emitWorkerFault("pwa-missing-style", { status: response.status, assetPath: new URL(request.url).pathname, controlled: true });
  target.searchParams.set(ASSET_RECOVERY_QUERY, VERSION);
  // The new inline bootstrap yields to this navigation. Older documents have
  // no working JavaScript and simply ignore the message.
  client.postMessage({ type: ASSET_RECOVERY_STARTED, url: request.url, status: response.status });
  const navigation = (async () => {
    try { if (await client.navigate(target.href)) return; } catch {}
    // A failed navigation did not consume the route's one successful repair.
    // Allow a later resource request to retry, and release a live bootstrap.
    try { await (await caches.open(STATIC_CACHE)).delete(key); } catch {}
    client.postMessage({ type: ASSET_RECOVERY_CANCELLED, url: request.url });
  })();
  await Promise.allSettled([navigation, reporting]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivate(url.pathname) || url.pathname === ESCAPE) return;
  // Safari may terminate a worker while it is awaiting a navigation. Keep
  // online navigation entirely browser-owned, including slow connections.
  if (request.mode === "navigate") {
    if (self.navigator.onLine === false) event.respondWith(offlineAnswer(request));
    return;
  }
  if (request.headers.get("RSC") !== null || url.search !== "") return;
  const immutable = url.pathname.startsWith("/_next/static/");
  if (!immutable && !(EXTRA_CACHE_PREFIX && url.pathname.startsWith(EXTRA_CACHE_PREFIX)) && !PRECACHE.includes(url.pathname)) return;
  let writing = Promise.resolve();
  const work = (async () => {
    const cached = await savedResponse(request, immutable);
    if (cached && cached.headers.get("content-type")?.split(";")[0].trim() !== "text/html") return cached;
    const response = await fetch(request);
    if (validResponse(response, request.url) && response.headers.get("content-type")?.split(";")[0].trim() !== "text/html") {
      writing = store(request, response.clone()).catch((error) => emitWorkerFault("pwa-cache-write", { errorType: error?.name }));
    } else if (immutable) {
      writing = recoverStylesheet(event, response).catch(() => {});
    }
    return response;
  })();
  event.respondWith(work);
  // A completed fetch no longer lets Safari terminate an unfinished cache put.
  event.waitUntil(work.then(() => writing, () => {}));
});
`;
