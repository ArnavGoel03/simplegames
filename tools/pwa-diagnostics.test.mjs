import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assetRecoverySource, ASSET_READY_EVENT } from "../src/lib/pwa/asset-recovery";
import { earlyDiagnosticsSource } from "../src/lib/pwa/early-source";
import { OPERATIONAL_FAULT_EVENT } from "../src/lib/pwa/diagnostic-limits";
import { STUDIO_DIAGNOSTIC_OUTBOX } from "../src/lib/pwa-config";

afterEach(() => vi.useRealTimers());
describe("the index's canonical early diagnostic integration", () => {
  it.each([true, false])("reports after hydration and requires the matching receipt (%s)", async (matching) => {
    vi.useFakeTimers();
    const window = Object.assign(new EventTarget(), { innerWidth: 1000, innerHeight: 800, matchMedia: () => ({ matches: false }) });
    const storage = new Map(); const sent = [];
    const fetch = vi.fn(async (_url, init) => {
      const report = JSON.parse(init.body); sent.push(report);
      return new Response(null, { status: 204, headers: { "x-diagnostic-id": matching ? report.id : "wrong-report" } });
    });
    const config = { app: { version: "0.3.1", commit: null, environment: "test" }, outboxKey: STUDIO_DIAGNOSTIC_OUTBOX, earlyOnly: false, readyEvent: ASSET_READY_EVENT };
    vm.runInNewContext(assetRecoverySource("test", earlyDiagnosticsSource(config)), {
      window, document: Object.assign(new EventTarget(), { readyState: "complete", querySelectorAll: () => [] }),
      navigator: { onLine: true, userAgent: "test", language: "en", platform: "test" },
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      sessionStorage: { getItem: () => null, removeItem: () => {} }, location: { href: "https://studio.test/", origin: "https://studio.test", reload: vi.fn() },
      URL, Event, CustomEvent, Error, Response, AbortController, AbortSignal, TextEncoder, crypto: webcrypto, fetch, setTimeout, clearTimeout,
    });
    window.dispatchEvent(new Event(ASSET_READY_EVENT));
    window.dispatchEvent(new CustomEvent(OPERATIONAL_FAULT_EVENT, { detail: { code: "pwa-update", operation: "pwa", errorType: "TypeError", message: "secret account", url: "https://private.test/token" } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1); expect(sent[0].app.version).toBe("0.3.1"); expect(sent[0].message).toBe("pwa-update");
    expect(JSON.stringify(sent[0])).not.toContain("secret account"); expect(JSON.stringify(sent[0])).not.toContain("private.test");
    expect(JSON.parse(storage.get(STUDIO_DIAGNOSTIC_OUTBOX) || "[]")).toHaveLength(matching ? 0 : 1);
    window.dispatchEvent(new CustomEvent(OPERATIONAL_FAULT_EVENT, { detail: { code: "invented-event", operation: "pwa" } }));
    await vi.advanceTimersByTimeAsync(0); expect(sent).toHaveLength(1);
  });
});
