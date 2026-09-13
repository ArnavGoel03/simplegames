import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnosticsProxy, DIAGNOSTIC_PROXY_TIMEOUT_MS } from "../src/lib/diagnostics-proxy";
import { MAX_REPORT_BYTES } from "../src/lib/pwa/diagnostic-limits";
import catalogue from "../src/lib/game-catalogue.json";
const origin = "https://studio.test";
const request = (body = '{}', extra = {}) => new Request(`${origin}/api/diagnostics`, { method: "POST", headers: { origin, "content-type": "application/json", ...extra }, body });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("studio diagnostics forwarding", () => {
  it("uses the redirect modes implemented by the edge runtime", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      if (options.redirect === "error") throw new TypeError('Invalid redirect value, must be one of "follow" or "manual"');
      expect(options.redirect).toBe("manual");
      return new Response(null, { status: 204, headers: { "x-diagnostic-id": "edge-report" } });
    }));
    const response = await diagnosticsProxy(request('{"id":"edge-report"}'));
    expect(response.status).toBe(204);
    expect(response.headers.get("x-diagnostic-id")).toBe("edge-report");
  });
  it("refuses upstream redirects without forwarding report data again", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 307, headers: { location: "https://elsewhere.test/report" } }));
    vi.stubGlobal("fetch", fetch);
    const response = await diagnosticsProxy(request());
    expect(response.status).toBe(503);
    expect(response.headers.has("location")).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("preserves the receipt and omits account cookies and authorization", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204, headers: { "x-diagnostic-id": "report-id", "set-cookie": "never=forward" } })); vi.stubGlobal("fetch", fetch);
    const result = await diagnosticsProxy(request('{"id":"report-id"}', { cookie: "secret", authorization: "secret" }));
    expect(result.status).toBe(204); expect(result.headers.get("x-diagnostic-id")).toBe("report-id"); expect(result.headers.has("set-cookie")).toBe(false);
    const [url, options] = fetch.mock.calls[0]; expect(url.origin).toBe(new URL(catalogue.sites.find(site => site.id === "chaupal").url).origin);
    expect(options.credentials).toBe("omit"); expect(options.headers).toEqual({ "content-type": "application/json", origin: url.origin });
  });
  it.each([403, 429, 503])("preserves upstream HTTP %i and retry instructions", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{}', { status, headers: { "retry-after": "20" } })));
    const result = await diagnosticsProxy(request()); expect(result.status).toBe(status); expect(result.headers.get("retry-after")).toBe("20");
  });
  it("rejects cross-origin, malformed and oversized requests before forwarding", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await diagnosticsProxy(request('{}', { origin: "https://other.test" }))).status).toBe(403);
    expect((await diagnosticsProxy(request('invalid'))).status).toBe(400);
    expect((await diagnosticsProxy(request('{}', { "content-length": String(MAX_REPORT_BYTES + 1) }))).status).toBe(413);
    expect((await diagnosticsProxy(request('x'.repeat(MAX_REPORT_BYTES + 1)))).status).toBe(413); expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds stalled request streams even if cancellation never resolves", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn());
    const stream = new ReadableStream({ pull: () => new Promise(() => {}), cancel: () => new Promise(() => {}) });
    const req = new Request(`${origin}/api/diagnostics`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: stream, duplex: "half" });
    const result = diagnosticsProxy(req); await vi.advanceTimersByTimeAsync(DIAGNOSTIC_PROXY_TIMEOUT_MS); expect((await result).status).toBe(503);
  });
  it("keeps network failures retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); })); expect((await diagnosticsProxy(request())).status).toBe(503);
  });
});
