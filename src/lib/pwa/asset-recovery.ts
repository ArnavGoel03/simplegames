/** Shared by the early document script and the hydrated worker client. */
export const ASSET_RECOVERY_EVENT = "gtg:asset-recovery";
export const ASSET_RECOVERY_STARTED = "gtg:asset-recovery-started";
export const ASSET_RECOVERY_CANCELLED = "gtg:asset-recovery-cancelled";
export const ASSET_READY_EVENT = "gtg:app-ready";
export const ASSET_RECOVERY_KEY = "gtg-asset-recovery";
export const ASSET_RECOVERY_QUERY = "__gtg_recovery";
export const ASSET_RECOVERY_LIMITS = { cooldownMs: 30_000, startupMs: 2_000, timeoutMs: 8_000, maxScripts: 32 } as const;
// A classic inline script waits for preceding stylesheets, including a stalled
// stylesheet it is supposed to repair. An async module has no such dependency.
export const ASSET_RECOVERY_SCRIPT_PROPS = { type: "module", async: true } as const;

/** No external script may be needed to recover a missing external script. */
export function assetRecoverySource(build: string, faultSource = ""): string {
  const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
  return `(() => {
${faultSource}
const emitFault = (code, details) => typeof reportOperationalFault === "function" ? reportOperationalFault(code, details) : Promise.resolve();
const BUILD = ${literal(build)};
const KEY = ${literal(ASSET_RECOVERY_KEY)};
const READY = ${literal(ASSET_READY_EVENT)};
const FAILED = ${literal(ASSET_RECOVERY_EVENT)};
const STARTED = ${literal(ASSET_RECOVERY_STARTED)};
const CANCELLED = ${literal(ASSET_RECOVERY_CANCELLED)};
const QUERY = ${literal(ASSET_RECOVERY_QUERY)};
const LIMITS = ${literal(ASSET_RECOVERY_LIMITS)};
let hydrated = window[READY] === true, healthyStartup = false, running = false, reloading = false, workerRecovery = false, probedScripts = false;
let workerTimer, queued = false;
const failed = new Set();
function asset(value) {
  try { const url = new URL(value, location.href); return url.origin === location.origin && url.pathname.startsWith("/_next/static/") ? url.href : null; } catch { return null; }
}
function styles() { return Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).filter(el => asset(el.href)); }
function styled(el) { try { return Boolean(el.sheet && el.sheet.cssRules.length); } catch { return false; } }
function faultDetails(url, status) {
  return { operation: "pwa", assetPath: new URL(url).pathname, status,
    readyState: document.readyState, hydrated, controlled: Boolean(navigator.serviceWorker?.controller) };
}
function healthy() {
  if (!hydrated || document.readyState === "loading" || failed.size || styles().some(el => !styled(el))) return;
  healthyStartup = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (saved && saved.build === BUILD) sessionStorage.removeItem(KEY);
  } catch {}
  try {
    const url = new URL(location.href);
    if (url.searchParams.has(QUERY)) { url.searchParams.delete(QUERY); history.replaceState(history.state, "", url.href); }
  } catch {}
}
function recoveryTarget() {
  const url = new URL(location.href);
  // This marker also bounds recovery when Safari refuses session storage or a
  // worker has already navigated. Keep the route, its other parameters and hash.
  if (url.searchParams.has(QUERY)) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (saved && (saved.build === BUILD || Date.now() - saved.at < LIMITS.cooldownMs)) return null;
  } catch {}
  url.searchParams.set(QUERY, BUILD + ":" + Date.now().toString(36));
  return url;
}
function wrongType(url, response) {
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return new URL(url).pathname.endsWith(".css") ? type !== "text/css" : type === "text/html";
}
async function evictFailure(url) {
  if (!("caches" in window)) return;
  try {
    for (const key of await caches.keys()) {
      const cache = await caches.open(key), hit = await cache.match(url);
      if (hit && (!hit.ok || wrongType(url, hit))) await cache.delete(url);
    }
  } catch {}
}
async function probe(url, remaining) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal });
    // A server outage is not evidence that a different document will work.
    const state = response.ok ? (wrongType(url, response) ? "missing" : "available") : response.status === 404 || response.status === 410 ? "missing" : null;
    return { state, status: response.status };
  } catch { return null; } finally { clearTimeout(timer); }
}
async function check() {
  if (running) { queued = true; return; }
  if (reloading || navigator.onLine === false) return;
  running = true;
  try {
    const candidates = new Map(Array.from(failed, url => [url, true]));
    for (const el of styles()) if (!styled(el) && !candidates.has(asset(el.href))) candidates.set(asset(el.href), document.readyState === "complete" && !el.sheet);
    // Next hoists its resources ahead of custom head children. A failed script
    // may therefore predate this listener and prevent React from ever mounting.
    if (!hydrated && !probedScripts && candidates.size === 0) {
      probedScripts = true;
      for (const el of Array.from(document.querySelectorAll("script[src]")).slice(0, LIMITS.maxScripts)) {
        const url = asset(el.src); if (url && !candidates.has(url)) candidates.set(url, false);
      }
    }
    let confirmed = [];
    const entries = Array.from(candidates);
    const deadline = Date.now() + LIMITS.timeoutMs;
    // At most three requests in flight, and none on an ordinary healthy load.
    for (let index = 0; index < entries.length; index += 3) {
      if (Date.now() >= deadline) break;
      await Promise.all(entries.slice(index, index + 3).map(async ([url, observed]) => {
        const result = await probe(url, Math.max(1, deadline - Date.now()));
        if (result?.state === "missing" || (result?.state === "available" && observed)) confirmed.push({ url, status: result.status });
      }));
    }
    if (reloading) return;
    // A delayed stylesheet can finish, or leave the document, during a probe.
    // Do not interrupt the now-working page for that obsolete observation.
    confirmed = confirmed.filter(({ url }) => {
      if (!new URL(url).pathname.endsWith(".css")) return true;
      if (styles().some(el => asset(el.href) === url && !styled(el))) return true;
      failed.delete(url); return false;
    });
    if (!confirmed.length) { healthy(); return; }
    const primary = confirmed.find(({ url }) => new URL(url).pathname.endsWith(".css")) || confirmed[0];
    const details = faultDetails(primary.url, primary.status);
    void emitFault(new URL(primary.url).pathname.endsWith(".css") ? "pwa-missing-style" : "pwa-missing-script", details);
    const brokenStyle = styles().some(el => !styled(el) && confirmed.some(({ url }) => url === asset(el.href)));
    if (healthyStartup && !brokenStyle) { window.dispatchEvent(new Event(FAILED)); return; }
    if (!recoveryTarget()) return;
    reloading = true;
    void emitFault("pwa-recovery", details);
    let cleanupTimer;
    await Promise.race([
      Promise.all(confirmed.map(({ url }) => evictFailure(url))),
      new Promise(resolve => { cleanupTimer = setTimeout(resolve, Math.max(1, deadline - Date.now())); }),
    ]);
    clearTimeout(cleanupTimer);
    if (workerRecovery) return;
    const target = recoveryTarget();
    if (!target) { reloading = false; return; }
    try { sessionStorage.setItem(KEY, JSON.stringify({ build: BUILD, at: Date.now() })); } catch {}
    location.replace(target.href);
  } finally { running = false; if (queued) { queued = false; void check(); } }
}
window.addEventListener("error", event => {
  const el = event.target;
  if (!(el instanceof HTMLScriptElement) && !(el instanceof HTMLLinkElement && el.rel === "stylesheet")) return;
  const url = asset(el instanceof HTMLScriptElement ? el.src : el.href);
  if (url) { failed.add(url); void check(); }
}, true);
function resumeRecovery() { clearTimeout(workerTimer); workerRecovery = false; reloading = false; void check(); }
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", event => {
  if (event.source !== navigator.serviceWorker.controller || !event.data) return;
  const url = asset(event.data.url);
  if (!url || !new URL(url).pathname.endsWith(".css")) return;
  if (event.data.type === CANCELLED && workerRecovery) { resumeRecovery(); return; }
  if (event.data.type !== STARTED || workerRecovery) return;
  failed.add(url); workerRecovery = true; reloading = true;
  void emitFault("pwa-recovery", faultDetails(url, event.data.status));
  // A worker can be terminated, or navigate() can fail. It must not silence a
  // still-open broken document forever. The URL/session guards remain in force.
  workerTimer = setTimeout(resumeRecovery, LIMITS.timeoutMs);
});
window.addEventListener(READY, () => { hydrated = true; healthy(); });
window.addEventListener("online", () => { probedScripts = false; void check(); });
window.addEventListener("pageshow", event => { if (event.persisted) void check(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void check(); });
document.addEventListener("DOMContentLoaded", () => { healthy(); void check(); }, { once: true });
window.addEventListener("load", () => { healthy(); void check(); }, { once: true });
// Async scripts, images and styles may hold window.load indefinitely.
setTimeout(() => { void check(); }, LIMITS.startupMs);
healthy();
})();`;
}
