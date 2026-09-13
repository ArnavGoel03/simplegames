import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceWorkerSource } from "../src/lib/pwa/service-worker";
import { earlyDiagnosticsSource } from "../src/lib/pwa/early-source";
import { STUDIO_WORKER_CONFIG, STUDIO_DIAGNOSTIC_OUTBOX, STUDIO_DIAGNOSTIC_SITE } from "../src/lib/pwa-config";
import { buildInfo } from "./build-info.mjs";

const effect = vi.hoisted(() => ({ run: null, ready: false }));
vi.mock("react", () => ({
  useEffect: run => { effect.run = run; },
  useState: () => [effect.ready, value => { effect.ready = value; }],
}));
import { ServiceWorker } from "../src/components/ServiceWorker";

const origin = "https://pwa.test";
function worker() {
  const handlers = new Map(), stores = new Map(), writes = [];
  const key = request => new URL(typeof request === "string" ? request : request.url, origin).href;
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return { match: async request => entries.get(key(request))?.clone(), put: async (request, response) => { entries.set(key(request), response.clone()); }, delete: async request => entries.delete(key(request)), keys: async () => [...entries.keys()].map(url => new Request(url)) };
  };
  const fetch = vi.fn(async request => {
    const path = new URL(typeof request === "string" ? request : request.url, origin).pathname;
    return path.endsWith(".css") ? new Response("body{color:red}", { headers: { "content-type": "text/css" } })
      : path.endsWith(".js") ? new Response("window.ready=true", { headers: { "content-type": "text/javascript" } })
      : new Response('<link rel="stylesheet" href="/_next/static/app.css"><script src="/_next/static/app.js"></script><p>home</p>', { headers: { "content-type": "text/html" } });
  });
  const navigator = { onLine: true };
  const source = serviceWorkerSource({ ...STUDIO_WORKER_CONFIG, appVersion: "test", appCommit: null });
  vm.runInNewContext(source, {
    URL, Response, Request, Headers, TextEncoder, TextDecoder, AbortSignal, Uint8Array, crypto: webcrypto, fetch,
    caches: { open: async name => cache(name), keys: async () => [...stores.keys()], delete: async name => stores.delete(name) },
    self: { location: { origin }, navigator, addEventListener: (name, handler) => handlers.set(name, handler), clients: { claim: async () => {} }, skipWaiting: async () => {} },
  });
  function request(path, { mode = "cors", headers = {}, method = "GET" } = {}) {
    let response;
    handlers.get("fetch")({ request: { url: new URL(path, origin).href, method, mode, headers: new Headers(headers) }, respondWith: pending => { response = pending; }, waitUntil: pending => { writes.push(pending); } });
    return response;
  }
  async function install() { let pending; handlers.get("install")({ waitUntil: work => { pending = work; } }); await pending; }
  return { request, fetch, stores, cache, writes, navigator, install };
}

afterEach(() => { vi.unstubAllGlobals(); effect.ready = false; });

describe("the studio's generated service worker", () => {
  it("is exactly the canonical source plus studio-only configuration", () => {
    const info = buildInfo();
    const faultSource = earlyDiagnosticsSource({ app: { version: info.NEXT_PUBLIC_APP_VERSION, commit: info.NEXT_PUBLIC_APP_COMMIT || null, environment: info.NEXT_PUBLIC_APP_ENVIRONMENT }, outboxKey: STUDIO_DIAGNOSTIC_OUTBOX, site: STUDIO_DIAGNOSTIC_SITE, worker: true });
    expect(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8")).toBe(serviceWorkerSource({ ...STUDIO_WORKER_CONFIG, faultSource, appVersion: info.NEXT_PUBLIC_APP_VERSION, appCommit: info.NEXT_PUBLIC_APP_COMMIT || null }));
  });
  it("leaves stable artwork to the network so replacement artwork cannot be frozen", () => {
    const sw = worker(); expect(sw.request("/art/chaupal-ludo.webp")).toBeUndefined(); expect(sw.fetch).not.toHaveBeenCalled();
  });
  it.each([["/about?_rsc=abc", {}], ["/about", { RSC: "1" }]])("leaves Flight %s untouched", (path, headers) => {
    const sw = worker(); expect(sw.request(path, { headers })).toBeUndefined(); expect(sw.fetch).not.toHaveBeenCalled();
  });
  it("caches a complete shell and only uses it for offline navigation", async () => {
    const sw = worker(); await sw.install();
    expect(sw.request("/about", { mode: "navigate" })).toBeUndefined();
    sw.navigator.onLine = false; sw.fetch.mockRejectedValue(new Error("offline"));
    expect(await (await sw.request("/about", { mode: "navigate" })).text()).toContain("home");
    expect(sw.request("/unrelated.png")).toBeUndefined();
    expect(await (await sw.request("/_next/static/app.css")).text()).toContain("color:red");
  });
  it("does not cache an HTML404 in place of a stylesheet", async () => {
    const sw = worker(); sw.fetch.mockResolvedValueOnce(new Response("missing", { status: 404, headers: { "content-type": "text/html" } }));
    expect((await sw.request("/_next/static/app.css")).status).toBe(404); await Promise.all(sw.writes);
    expect((await sw.request("/_next/static/app.css")).status).toBe(200); await Promise.all(sw.writes); expect(sw.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("the footer adapter to shared registration", () => {
  function environment() {
    const window = Object.assign(new EventTarget(), { location: { reload: vi.fn() } });
    const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const registration = Object.assign(new EventTarget(), { update: vi.fn(async () => {}), waiting: null, installing: null });
    const serviceWorker = Object.assign(new EventTarget(), { controller: {}, register: vi.fn(async () => registration) });
    vi.stubGlobal("window", window); vi.stubGlobal("document", document); vi.stubGlobal("navigator", { serviceWorker, onLine: true });
    return { window, registration, serviceWorker };
  }
  it("shows the existing update indicator without resetting a running demonstration", async () => {
    const h = environment(); ServiceWorker(); const stop = effect.run(); await new Promise(resolve => setTimeout(resolve, 0));
    h.registration.waiting = { postMessage: vi.fn() }; h.registration.dispatchEvent(new Event("updatefound"));
    expect(effect.ready).toBe(true); expect(h.window.location.reload).not.toHaveBeenCalled(); stop();
  });
  it("ignores registration that resolves after unmount", async () => {
    const h = environment(); let resolve; h.serviceWorker.register.mockReturnValue(new Promise(done => { resolve = done; }));
    ServiceWorker(); effect.run()(); resolve(h.registration); await new Promise(done => setTimeout(done, 0));
    expect(h.registration.update).not.toHaveBeenCalled(); expect(effect.ready).toBe(false);
  });
});
