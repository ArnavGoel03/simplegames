import { readFileSync } from "node:fs";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const effect = vi.hoisted(() => ({ run: null }));
vi.mock("react", () => ({ useEffect: (run) => { effect.run = run; } }));
import { ServiceWorker } from "../src/components/ServiceWorker";

const origin = "https://glasstablegames.com";

function worker() {
  const handlers = new Map();
  const stored = new Map();
  const writes = [];
  const key = (request) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const cache = {
    match: async (request) => stored.get(key(request))?.clone(),
    put: vi.fn(async (request, response) => { stored.set(key(request), response); }),
  };
  const fetch = vi.fn(async () => new Response("network"));
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    URL,
    Response,
    fetch,
    caches: { open: async () => cache, match: cache.match },
    self: { location: { origin }, addEventListener: (name, handler) => handlers.set(name, handler) },
  });
  function request(path, { mode = "cors", headers = {}, method = "GET" } = {}) {
    let response;
    handlers.get("fetch")({
      request: { url: new URL(path, origin).href, method, mode, headers: new Headers(headers) },
      respondWith: (pending) => { response = pending; },
      waitUntil: (pending) => { writes.push(pending); },
    });
    return response;
  }
  return { request, fetch, cache, stored, writes };
}

afterEach(() => vi.unstubAllGlobals());

describe("the shipped service worker", () => {
  it("refreshes stable artwork URLs after their contents change", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(new Response("old artwork"));
    expect(await (await sw.request("/art/chaupal-ludo.webp")).text()).toBe("old artwork");
    await Promise.all(sw.writes);
    sw.fetch.mockResolvedValueOnce(new Response("new artwork"));
    expect(await (await sw.request("/art/chaupal-ludo.webp")).text()).toBe("new artwork");
  });

  it.each([
    ["/about?_rsc=abc", {}],
    ["/about", { RSC: "1" }],
  ])("leaves Flight request %s to Next's offline recovery", (path, headers) => {
    const sw = worker();
    expect(sw.request(path, { headers })).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("uses the homepage fallback for navigation only", async () => {
    const sw = worker();
    sw.stored.set(`${origin}/`, new Response("home"));
    sw.fetch.mockRejectedValue(new Error("offline"));
    expect(await (await sw.request("/about", { mode: "navigate" })).text()).toBe("home");
    expect((await sw.request("/icon-512.png")).type).toBe("error");
  });

  it("keeps a cache write alive and treats storage refusal as optional", async () => {
    const sw = worker();
    sw.cache.put.mockRejectedValue(new Error("quota exceeded"));
    const response = await sw.request("/about", { mode: "navigate" });
    expect(await response.text()).toBe("network");
    expect(sw.writes).toHaveLength(1);
    await expect(Promise.all(sw.writes)).resolves.toEqual([undefined]);
  });

  it("continues serving cached immutable chunks without a network request", async () => {
    const sw = worker();
    sw.stored.set(`${origin}/_next/static/chunks/hash.js`, new Response("chunk"));
    expect(await (await sw.request("/_next/static/chunks/hash.js")).text()).toBe("chunk");
    expect(sw.fetch).not.toHaveBeenCalled();
  });
});

describe("service worker registration", () => {
  it.each([false, true])("reloads only a replaced controller (existing: %s)", (controlled) => {
    const listeners = new Map();
    const reload = vi.fn();
    const serviceWorker = {
      controller: controlled ? {} : null,
      register: vi.fn(async () => ({})),
      addEventListener: (name, listener) => listeners.set(name, listener),
      removeEventListener: (name) => listeners.delete(name),
    };
    vi.stubGlobal("navigator", { serviceWorker });
    vi.stubGlobal("document", { readyState: "complete" });
    vi.stubGlobal("window", { location: { reload }, removeEventListener: vi.fn() });
    ServiceWorker();
    const cleanup = effect.run();
    serviceWorker.controller = {};
    listeners.get("controllerchange")();
    expect(reload).toHaveBeenCalledTimes(controlled ? 1 : 0);
    listeners.get("controllerchange")();
    listeners.get("controllerchange")();
    expect(reload).toHaveBeenCalledTimes(1);
    cleanup();
    expect(listeners.size).toBe(0);
  });
});
