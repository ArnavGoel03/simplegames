// Executed as generated worker JavaScript. Keep browser globals inside the
// string so importing the route on the server does not touch worker APIs.
export const WORKER_RUNTIME = String.raw`
// Three generations protect recently restored documents without retaining
// every release forever. Each cache is also bounded by count and decoded bytes.
const MAX_GENERATIONS = 3;
const MAX_ENTRIES = MAX_OFFLINE_PATHS;
const MAX_CACHE_BYTES = ASSET_MANIFEST_TOTAL_BYTES;
const MAX_RESPONSE_BYTES = ASSET_MANIFEST_FILE_BYTES;
const MAX_DEPENDENCIES = ASSET_MANIFEST_LIMIT;
const SIZE_HEADER = "x-gtg-cache-bytes";
const DEPS_HEADER = "x-gtg-cache-dependencies";
const HASH_HEADER = "x-gtg-cache-sha256";
const MANIFEST_HEADER = "x-gtg-cache-asset-manifest";
const READY_PATH = "/_pwa/offline-ready";
// A hotspot may be connected while its internet route silently drops packets.
const NAVIGATION_TIMEOUT_MS = 4000;
let writes = Promise.resolve();
let preloading = null;
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

function manifestAssetUrl(value) {
  const url = new URL(value, self.location.origin);
  return assetUrl(value) || (url.origin === self.location.origin && !url.search &&
    WORD_ASSET_PATHS.includes(url.pathname) ? url : null);
}

function validResponse(response, url) {
  if (!response || !response.ok || response.status === 206 || response.redirected) return false;
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const path = new URL(url, self.location.origin).pathname;
  if (WORD_ASSET_PATHS.includes(path)) return type === WORD_ASSET_CONTENT_TYPE;
  if (path.endsWith(".css")) return type === "text/css";
  if (/\.m?js$/.test(path)) return ["text/javascript", "application/javascript", "application/x-javascript"].includes(type);
  if (/\.(woff2?|ttf|otf)$/.test(path)) return type.startsWith("font/") || type.startsWith("application/font") || type === "application/octet-stream";
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/.test(path)) return type.startsWith("image/");
  if (path.endsWith(".wasm")) return type === "application/wasm";
  if (path.endsWith(".txt")) return type === "text/plain";
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

async function bodyHash(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function validCachedResponse(response, url, requireHash = false) {
  if (!validResponse(response, url)) return false;
  const expected = response.headers.get(HASH_HEADER);
  // Older immutable caches are copied and rehashed during installation. A
  // generation advertised as complete requires checksums on every dependency.
  if (!expected) return !requireHash;
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  try { return await bodyHash(await limitedBody(response.clone())) === expected; }
  catch { return false; }
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

async function store(request, response, dependencies, expected, manifest) {
  const body = await limitedBody(response);
  const hash = await bodyHash(body);
  if (expected && (body.byteLength !== expected.bytes || hash !== expected.sha256)) throw new Error("offline asset checksum mismatch");
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  if (expected && manifestAssetUrl(typeof request === "string" ? request : request.url)) {
    // These manifest-bound bytes are decoded already, so wire encoding cannot
    // vary their saved representation. Other variants keep their normal checks.
    const vary = (headers.get("vary") || "").split(",").map(field => field.trim()).filter(Boolean)
      .filter(field => field.toLowerCase() !== "accept-encoding");
    if (vary.length) headers.set("vary", vary.join(", "));
    else headers.delete("vary");
  }
  headers.set(SIZE_HEADER, String(body.byteLength));
  headers.set(HASH_HEADER, hash);
  if (dependencies) headers.set(DEPS_HEADER, JSON.stringify(dependencies));
  else headers.delete(DEPS_HEADER);
  if (manifest) headers.set(MANIFEST_HEADER, manifest);
  else headers.delete(MANIFEST_HEADER);
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
    const requestedUrl = new URL(typeof request === "string" ? request : request.url, self.location.origin).href;
    const notices = new URL(requestedUrl).pathname === NOTICES_PATH && PRECACHE.includes(NOTICES_PATH);
    const desired = immutable && ASSET_MANIFEST ? (await manifestMetadataFrom(STATIC_CACHE, ASSET_MANIFEST))?.assets.get(requestedUrl) : null;
    for (const name of await cacheNames(immutable || notices)) {
      if (notices && name !== STATIC_CACHE && !await generationReady(name)) continue;
      const cache = await caches.open(name);
      const hit = await cache.match(request);
      if (!hit) continue;
      if (immutable && ASSET_MANIFEST) {
        const metadata = await manifestMetadataFrom(name, ASSET_MANIFEST);
        const expected = metadata?.assets.get(requestedUrl);
        if (expected && (hit.headers.get(HASH_HEADER) !== expected.sha256 || Number(hit.headers.get(SIZE_HEADER)) !== expected.bytes)) {
          await cache.delete(request); continue;
        }
      }
      // The same path in a previous release is usable only when its bytes
      // match this build. Preserve a different previous copy for its own HTML.
      if (desired && (hit.headers.get(HASH_HEADER) !== desired.sha256 || Number(hit.headers.get(SIZE_HEADER)) !== desired.bytes)) continue;
      if (await validCachedResponse(hit, typeof request === "string" ? request : request.url)) return hit;
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

function decodeAssetManifest(value, release) {
  if (!value || typeof value !== "object" || value.version !== ASSET_MANIFEST_FORMAT || value.release !== release ||
      !Array.isArray(value.assets) || !value.assets.length || value.assets.length > ASSET_MANIFEST_LIMIT) throw new Error("invalid offline asset manifest");
  const assets = new Map();
  let bytes = 0;
  for (const entry of value.assets) {
    if (!entry || typeof entry !== "object" || typeof entry.path !== "string" ||
        entry.path.length > 2048 || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > ASSET_MANIFEST_FILE_BYTES) throw new Error("invalid offline asset entry");
    const url = manifestAssetUrl(entry.path);
    if (!url || url.hash || url.pathname !== entry.path || assets.has(url.href)) throw new Error("invalid offline asset path");
    bytes += entry.bytes;
    if (bytes > ASSET_MANIFEST_TOTAL_BYTES) throw new Error("offline asset manifest exceeds cache budget");
    assets.set(url.href, { sha256: entry.sha256, bytes: entry.bytes });
  }
  return assets;
}

async function manifestMetadataFrom(name, path) {
  try {
    const url = new URL(path, self.location.origin);
    if (url.origin !== self.location.origin || url.search || url.hash || isPrivate(url.pathname) || url.pathname === ESCAPE) return null;
    const cache = await caches.open(name);
    const response = await cache.match(path);
    if (!response || !await validCachedResponse(response, path, true)) return null;
    const assets = decodeAssetManifest(JSON.parse(new TextDecoder().decode(await limitedBody(response))), name.slice(0, -7));
    return { path, assets };
  } catch { return null; }
}

async function verifiedManifestFrom(name, path) {
  try {
    const metadata = await manifestMetadataFrom(name, path);
    if (!metadata) return null;
    const cache = await caches.open(name);
    for (const [asset, expected] of metadata.assets) {
      const saved = await cache.match(asset);
      if (!saved || saved.headers.get(HASH_HEADER) !== expected.sha256 || Number(saved.headers.get(SIZE_HEADER)) !== expected.bytes ||
          !await validCachedResponse(saved, asset, true)) return null;
    }
    return metadata;
  } catch { return null; }
}

async function preload() {
  const pending = new Map();
  let manifestAssets = null;
  let manifestFailed = false;
  // One asset fetch budget across every document and nested stylesheet.
  const ASSET_DOWNLOAD_CONCURRENCY = 4;
  let downloading = 0;
  const downloads = [];
  async function download(url) {
    if (downloading >= ASSET_DOWNLOAD_CONCURRENCY) await new Promise(resolve => downloads.push(resolve));
    else downloading++;
    try {
      if (manifestFailed) throw new Error("offline asset manifest download aborted");
      const expected = manifestAssets?.get(url);
      let response = await savedResponse(url, true);
      if (expected && response && (response.headers.get(HASH_HEADER) !== expected.sha256 || Number(response.headers.get(SIZE_HEADER)) !== expected.bytes)) response = null;
      response ||= await fetch(url, {
        cache: "reload", credentials: "omit", signal: AbortSignal.timeout(10000),
      });
      if (!validResponse(response, url)) throw new Error("offline asset unavailable");
      // Drain and cache the body before handing the slot to another request.
      await store(url, response.clone(), undefined, expected);
      return response;
    } catch (error) {
      if (manifestAssets) manifestFailed = true;
      throw error;
    } finally {
      const next = downloads.shift();
      if (next) next(); else downloading--;
    }
  }
  async function dependenciesFor(urls) {
    const visited = new Set(urls);
    let frontier = [...visited];
    while (frontier.length) {
      const results = await Promise.all(frontier.map(url => asset(url)));
      frontier = [];
      for (const children of results) for (const child of children) {
        if (!visited.has(child)) { visited.add(child); frontier.push(child); }
      }
      if (visited.size > MAX_DEPENDENCIES) throw new Error("too many offline dependencies");
    }
    return [...visited];
  }
  async function asset(url) {
    if (manifestAssets && !manifestAssets.has(url)) throw new Error("offline asset missing from build manifest");
    if (pending.has(url)) return pending.get(url);
    if (pending.size >= MAX_ENTRIES) throw new Error("too many offline assets");
    // Shared promises cover one asset only. Recursive waits between shared
    // stylesheet promises could deadlock when their dependencies form a cycle.
    const work = (async () => {
      const response = await download(url);
      if (!new URL(url).pathname.endsWith(".css")) return [];
      const css = new TextDecoder().decode(await limitedBody(response.clone()));
      return [...styleAssets(css, url)];
    })();
    pending.set(url, work);
    return work;
  }

  if (ASSET_MANIFEST) {
    const response = await fetch(ASSET_MANIFEST, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(10000) });
    if (!validResponse(response, ASSET_MANIFEST)) throw new Error("offline asset manifest unavailable");
    manifestAssets = decodeAssetManifest(JSON.parse(new TextDecoder().decode(await limitedBody(response.clone()))), VERSION);
    await dependenciesFor(manifestAssets.keys());
    await store(ASSET_MANIFEST, response.clone());
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
        // Manifest assets were already downloaded and checked against this
        // release. A second unbound fetch must not replace their verified bytes.
        if (manifestAssets?.has(new URL(path, self.location.origin).href)) continue;
        const response = await fetch(path, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(10000) });
        if (!validResponse(response, path)) { void emitWorkerFault("pwa-precache", { status: response.status }); continue; }
        if (response.headers.get("content-type")?.split(";")[0].trim() !== "text/html") {
          await store(path, response.clone());
          continue;
        }
        const html = new TextDecoder().decode(await limitedBody(response.clone()));
        const dependencies = documentAssets(html, new URL(path, self.location.origin).href);
        for (const asset of manifestAssets?.keys() || []) dependencies.add(asset);
        for (const child of await dependenciesFor(dependencies)) dependencies.add(child);
        if (PRECACHE.includes(NOTICES_PATH)) dependencies.add(new URL(NOTICES_PATH, self.location.origin).href);
        if (dependencies.size > MAX_DEPENDENCIES) throw new Error("too many offline dependencies");
        await store(path, response.clone(), [...dependencies], undefined, ASSET_MANIFEST);
      } catch (error) { void emitWorkerFault("pwa-precache", { errorType: error?.name }); }
    }
  }));
  const readiness = await readinessFor(urls);
  if (readiness.ready) {
    await store(READY_PATH, new Response(JSON.stringify({ version: VERSION, paths: urls, assetManifest: ASSET_MANIFEST }), {
      headers: { "content-type": "application/json" },
    }));
    // The receipt itself consumes cache budget. Never leave a ready marker if
    // its insertion evicted a document or one of the required build assets.
    if (!await generationReady(STATIC_CACHE)) await (await caches.open(STATIC_CACHE)).delete(READY_PATH);
  }
}

function downloadOfflineCopy() {
  if (!preloading) preloading = preload().finally(() => { preloading = null; });
  return preloading;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(downloadOfflineCopy().catch(() => {}));
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
      // Repeated failed updates must never age the last complete release out.
      const complete = [];
      for (const name of previous) if (await generationReady(name)) complete.push(name);
      const keep = new Set([...complete.reverse(), ...previous.slice().reverse()].slice(0, MAX_GENERATIONS - 1));
      for (const name of previous) if (!keep.has(name)) await caches.delete(name);
      for (const name of [STATIC_CACHE, ...keep]) {
        await trimCache(await caches.open(name));
      }
    } catch (error) { void emitWorkerFault("pwa-cache-write", { errorType: error?.name }); }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
  const data = event.data;
  if (!data || typeof data !== "object" || ![OFFLINE_STATUS_MESSAGE, OFFLINE_DOWNLOAD_MESSAGE].includes(data.type)) return;
  const port = event.ports?.[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      if (data.type === OFFLINE_DOWNLOAD_MESSAGE) await downloadOfflineCopy();
      const requested = Array.isArray(data.paths) ? data.paths : PRECACHE;
      const allowed = new Set([...PRECACHE, START_URL]);
      const paths = requested.filter(path => typeof path === "string" && allowed.has(path)).slice(0, MAX_ENTRIES);
      if (paths.length !== requested.length) throw new Error("invalid offline paths");
      const readiness = await readinessFor(paths);
      const backupVersions = [];
      for (const name of await cacheNames(true)) if (name !== STATIC_CACHE && await generationReady(name)) backupVersions.push(name.slice(0, -7));
      port.postMessage({ type: OFFLINE_STATUS_MESSAGE, version: VERSION, ...readiness, backupVersions });
    } catch { port.postMessage({ type: OFFLINE_STATUS_MESSAGE, version: VERSION, ready: false, paths: [], missing: [], backupVersions: [], error: "offline-copy-unavailable" }); }
  })());
});

async function documentFrom(name, request, verifiedManifest) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (!hit || hit.headers.get("content-type")?.split(";")[0].trim() !== "text/html" ||
    !await validCachedResponse(hit, typeof request === "string" ? request : request.url, true)) return null;
  try {
    const dependencies = JSON.parse(hit.headers.get(DEPS_HEADER) || "null");
    if (!Array.isArray(dependencies) || dependencies.length > MAX_DEPENDENCIES) return null;
    const notices = new URL(NOTICES_PATH, self.location.origin).href;
    if (name === STATIC_CACHE && PRECACHE.includes(NOTICES_PATH) && !dependencies.includes(notices)) return null;
    const manifest = hit.headers.get(MANIFEST_HEADER);
    if ((name === STATIC_CACHE && ASSET_MANIFEST && manifest !== ASSET_MANIFEST) || (verifiedManifest && manifest !== verifiedManifest.path)) return null;
    if (manifest) {
      if (!verifiedManifest || verifiedManifest.path !== manifest) verifiedManifest = await verifiedManifestFrom(name, manifest);
      if (!verifiedManifest || [...verifiedManifest.assets.keys()].some((asset) => !dependencies.includes(asset))) return null;
    }
    for (const url of dependencies) {
      if (url === notices) {
        if (!await validCachedResponse(await cache.match(url), url, true)) return null;
        continue;
      }
      if (verifiedManifest) { if (!verifiedManifest.assets.has(url)) return null; continue; }
      const dependency = typeof url === "string" && assetUrl(url) ? await cache.match(url) : null;
      if (!dependency || !await validCachedResponse(dependency, url, true)) {
        void emitWorkerFault("pwa-offline-incomplete");
        return null;
      }
    }
    return hit;
  } catch { return null; }
}

async function completeResponse(name, request, verifiedManifest) {
  const hit = await (await caches.open(name)).match(request);
  if (!hit || !await validCachedResponse(hit, typeof request === "string" ? request : request.url, true)) return null;
  return hit.headers.get("content-type")?.split(";")[0].trim() === "text/html" ? documentFrom(name, request, verifiedManifest) : hit;
}

async function readinessFor(paths) {
  if (PRECACHE.includes(NOTICES_PATH) && !await validCachedResponse(await (await caches.open(STATIC_CACHE)).match(NOTICES_PATH), NOTICES_PATH, true)) {
    return { ready: false, paths: [], missing: paths };
  }
  const verifiedManifest = ASSET_MANIFEST ? await verifiedManifestFrom(STATIC_CACHE, ASSET_MANIFEST) : null;
  if (ASSET_MANIFEST && !verifiedManifest) return { ready: false, paths: [], missing: paths };
  const saved = [];
  const missing = [];
  for (const path of paths) (await completeResponse(STATIC_CACHE, path, verifiedManifest) ? saved : missing).push(path);
  return { ready: paths.length > 0 && missing.length === 0, paths: saved, missing };
}

async function generationReady(name) {
  try {
    const receipt = await (await caches.open(name)).match(READY_PATH);
    if (!receipt || !await validCachedResponse(receipt, READY_PATH, true)) return false;
    const data = JSON.parse(new TextDecoder().decode(await limitedBody(receipt)));
    if (data.version !== name.slice(0, -7) || !Array.isArray(data.paths) || !data.paths.length || data.paths.length > MAX_ENTRIES) return false;
    if (name === STATIC_CACHE && ASSET_MANIFEST && data.assetManifest !== ASSET_MANIFEST) return false;
    const verifiedManifest = data.assetManifest ? await verifiedManifestFrom(name, data.assetManifest) : null;
    if (data.assetManifest && !verifiedManifest) return false;
    for (const path of data.paths) {
      if (typeof path !== "string") return false;
      const url = new URL(path, self.location.origin);
      if (url.origin !== self.location.origin || isPrivate(url.pathname) || url.pathname === ESCAPE || !await completeResponse(name, path, verifiedManifest)) return false;
    }
    return true;
  } catch { return false; }
}

async function savedDocument(request) {
  try {
    for (const name of await cacheNames(true)) {
      if (name !== STATIC_CACHE && !await generationReady(name)) continue;
      const hit = await documentFrom(name, request);
      if (hit) return hit;
    }
  } catch { /* Eviction or denied storage cannot keep the escape page hidden. */ }
  return null;
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
  const key = self.location.origin + "/_pwa/recovery/" + await bodyHash(new TextEncoder().encode(target.pathname + target.search));
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
  // Connectivity is established by the request, not navigator.onLine: shared
  // Wi-Fi and phone hotspots can be online locally with no usable internet.
  if (request.mode === "navigate") {
    if (self.navigator.onLine === false) event.respondWith(offlineAnswer(request));
    else event.respondWith(fetch(request, { signal: AbortSignal.timeout(NAVIGATION_TIMEOUT_MS) }).then(async response => {
      if (response.status >= 500) {
        const fallback = await savedDocument(request) || await savedDocument(url.pathname);
        if (fallback) return fallback;
      }
      return response;
    }).catch(() => offlineAnswer(request)));
    return;
  }
  if (request.headers.get("RSC") !== null || url.search !== "") return;
  const immutable = url.pathname.startsWith("/_next/static/") || (ASSET_MANIFEST && WORD_ASSET_PATHS.includes(url.pathname));
  if (!immutable && !(EXTRA_CACHE_PREFIX && url.pathname.startsWith(EXTRA_CACHE_PREFIX)) && !PRECACHE.includes(url.pathname)) return;
  let writing = Promise.resolve();
  const work = (async () => {
    const cached = await savedResponse(request, immutable);
    if (cached && cached.headers.get("content-type")?.split(";")[0].trim() !== "text/html") return cached;
    const response = await fetch(request);
    if (validResponse(response, request.url) && response.headers.get("content-type")?.split(";")[0].trim() !== "text/html") {
      const expected = immutable && ASSET_MANIFEST ? (await manifestMetadataFrom(STATIC_CACHE, ASSET_MANIFEST))?.assets.get(url.href) : null;
      if (expected) {
        try { await store(request, response.clone(), undefined, expected); }
        catch (error) {
          writing = emitWorkerFault("pwa-cache-write", { errorType: error?.name });
          return new Response(null, { status: 502 });
        }
      } else writing = store(request, response.clone()).catch((error) => emitWorkerFault("pwa-cache-write", { errorType: error?.name }));
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
