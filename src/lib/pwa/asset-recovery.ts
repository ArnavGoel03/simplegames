/** Shared by the early document script and the hydrated worker client. */
export const ASSET_RECOVERY_EVENT = "gtg:asset-recovery";
export const ASSET_RECOVERY_STARTED = "gtg:asset-recovery-started";
export const ASSET_READY_EVENT = "gtg:app-ready";
export const ASSET_RECOVERY_KEY = "gtg-asset-recovery";
export const ASSET_RECOVERY_LIMITS = { cooldownMs: 30_000, startupMs: 2_000, timeoutMs: 8_000, maxScripts: 32 } as const;

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
const LIMITS = ${literal(ASSET_RECOVERY_LIMITS)};
let hydrated = false, healthyStartup = false, running = false, reloading = false, workerRecovery = false, probedScripts = false;
const failed = new Set();
function asset(value) {
  try { const url = new URL(value, location.href); return url.origin === location.origin && url.pathname.startsWith("/_next/static/") ? url.href : null; } catch { return null; }
}
function styles() { return Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).filter(el => asset(el.href)); }
function styled(el) { try { return Boolean(el.sheet && el.sheet.cssRules.length); } catch { return false; } }
function healthy() {
  if (!hydrated || document.readyState !== "complete" || failed.size || styles().some(el => !styled(el))) return;
  healthyStartup = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (saved && saved.build === BUILD) sessionStorage.removeItem(KEY);
  } catch {}
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
    return response.ok ? (wrongType(url, response) ? "missing" : "available") : response.status === 404 || response.status === 410 ? "missing" : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
async function check() {
  if (running || reloading || navigator.onLine === false || document.readyState !== "complete") return;
  running = true;
  try {
    const candidates = new Map(Array.from(failed, url => [url, true]));
    for (const el of styles()) if (!styled(el) && !candidates.has(asset(el.href))) candidates.set(asset(el.href), !el.sheet);
    // Next hoists its resources ahead of custom head children. A failed script
    // may therefore predate this listener and prevent React from ever mounting.
    if (!hydrated && !probedScripts && candidates.size === 0) {
      probedScripts = true;
      for (const el of Array.from(document.querySelectorAll("script[src]")).slice(0, LIMITS.maxScripts)) {
        const url = asset(el.src); if (url && !candidates.has(url)) candidates.set(url, false);
      }
    }
    const confirmed = [];
    const entries = Array.from(candidates);
    const deadline = Date.now() + LIMITS.timeoutMs;
    // At most three requests in flight, and none on an ordinary healthy load.
    for (let index = 0; index < entries.length; index += 3) {
      if (Date.now() >= deadline) break;
      await Promise.all(entries.slice(index, index + 3).map(async ([url, observed]) => {
        const state = await probe(url, Math.max(1, deadline - Date.now()));
        if (state === "missing" || (state === "available" && observed)) confirmed.push(url);
      }));
    }
    if (reloading) return;
    if (!confirmed.length) { healthy(); return; }
    void emitFault(confirmed.some(url => new URL(url).pathname.endsWith(".css")) ? "pwa-missing-style" : "pwa-missing-script", { operation: "pwa" });
    const brokenStyle = styles().some(el => !styled(el) && confirmed.includes(asset(el.href)));
    if (healthyStartup && !brokenStyle) { window.dispatchEvent(new Event(FAILED)); return; }
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (saved && (saved.build === BUILD || Date.now() - saved.at < LIMITS.cooldownMs)) return;
      sessionStorage.setItem(KEY, JSON.stringify({ build: BUILD, at: Date.now() }));
    } catch { return; }
    reloading = true;
    void emitFault("pwa-recovery", { operation: "pwa" });
    await Promise.all(confirmed.map(evictFailure));
    if (!workerRecovery) location.reload();
  } finally { running = false; }
}
window.addEventListener("error", event => {
  const el = event.target;
  if (!(el instanceof HTMLScriptElement) && !(el instanceof HTMLLinkElement && el.rel === "stylesheet")) return;
  const url = asset(el instanceof HTMLScriptElement ? el.src : el.href);
  if (url) { failed.add(url); if (document.readyState === "complete") void check(); }
}, true);
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", event => {
  if (event.source !== navigator.serviceWorker.controller || !event.data || event.data.type !== STARTED) return;
  const url = asset(event.data.url);
  if (url && new URL(url).pathname.endsWith(".css")) { workerRecovery = true; reloading = true; void emitFault("pwa-recovery", { operation: "pwa" }); }
});
window.addEventListener(READY, () => { hydrated = true; healthy(); });
window.addEventListener("online", () => { probedScripts = false; void check(); });
window.addEventListener("pageshow", event => { if (event.persisted) void check(); });
function loaded() { setTimeout(() => { void check(); }, LIMITS.startupMs); }
if (document.readyState === "complete") loaded(); else window.addEventListener("load", loaded, { once: true });
})();`;
}
