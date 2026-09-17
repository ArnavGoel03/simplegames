import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assetRecoverySource, ASSET_READY_EVENT } from "../src/lib/pwa/asset-recovery";
import { earlyDiagnosticsSource } from "../src/lib/pwa/early-source";
import { OPERATIONAL_FAULT_EVENT } from "../src/lib/pwa/diagnostic-limits";
import { LEGACY_STUDIO_DIAGNOSTIC_OUTBOX, studioPrivacyCleanupSource } from "../src/lib/pwa-privacy";

function environment(denied = false) {
  const window = Object.assign(new EventTarget(), { innerWidth: 1000, innerHeight: 800, matchMedia: () => ({ matches: false }) });
  const storage = new Map([[LEGACY_STUDIO_DIAGNOSTIC_OUTBOX, '[{"report":{"id":"old"},"attempts":0}]'], ["unrelated", "keep"]]);
  const fetch = vi.fn(async () => new Response(null, { status: 410 }));
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => { if (denied) throw new Error("Storage unavailable"); storage.delete(key); },
  };
  const context = {
    window, document: Object.assign(new EventTarget(), { readyState: "complete", querySelectorAll: () => [] }),
    navigator: { onLine: true, userAgent: "test", language: "en", platform: "test" }, localStorage,
    sessionStorage: { getItem: () => null, removeItem: () => {} }, location: { href: "https://studio.test/", origin: "https://studio.test", reload: vi.fn() },
    HTMLScriptElement: class {}, HTMLLinkElement: class {},
    URL, Event, CustomEvent, Error, Response, AbortController, AbortSignal, TextEncoder, crypto: webcrypto, fetch, setTimeout, clearTimeout,
  };
  return { context, window, storage, fetch };
}
function faults(window) {
  window.dispatchEvent(new Event(ASSET_READY_EVENT));
  window.dispatchEvent(new CustomEvent(OPERATIONAL_FAULT_EVENT, { detail: { code: "pwa-update", operation: "pwa", errorType: "TypeError" } }));
  window.dispatchEvent(Object.assign(new Event("error"), { error: new Error("failure"), message: "failure" }));
  window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("rejection") }));
  window.dispatchEvent(new Event("online"));
}

afterEach(() => vi.useRealTimers());
describe("studio recovery without automatic reporting", () => {
  it.each([false, true])("never reports faults or retries old reports, including denied storage (%s)", async denied => {
    vi.useFakeTimers();
    const env = environment(denied);
    vm.runInNewContext(assetRecoverySource("test", studioPrivacyCleanupSource()), env.context);
    faults(env.window);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(env.fetch).not.toHaveBeenCalled();
    expect(env.storage.get("unrelated")).toBe("keep");
    expect(env.storage.has(LEGACY_STUDIO_DIAGNOSTIC_OUTBOX)).toBe(denied);
  });
  it("detects the previous automatic reporter as a positive control", async () => {
    vi.useFakeTimers();
    const env = environment(); env.storage.delete(LEGACY_STUDIO_DIAGNOSTIC_OUTBOX);
    vm.runInNewContext(assetRecoverySource("test", earlyDiagnosticsSource({ app: { version: "test", commit: null, environment: "test" }, outboxKey: LEGACY_STUDIO_DIAGNOSTIC_OUTBOX, earlyOnly: false, readyEvent: ASSET_READY_EVENT })), env.context);
    faults(env.window);
    await vi.advanceTimersByTimeAsync(0);
    expect(env.fetch).toHaveBeenCalled();
    expect(env.fetch.mock.calls.some(([url, init]) => url === "/api/diagnostics" && init.method === "POST")).toBe(true);
    expect(JSON.parse(env.storage.get(LEGACY_STUDIO_DIAGNOSTIC_OUTBOX))).toEqual([]);
  });
});
