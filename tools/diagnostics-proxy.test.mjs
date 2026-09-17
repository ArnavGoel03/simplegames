import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/diagnostics/route";

afterEach(() => vi.unstubAllGlobals());
describe("retired studio diagnostics endpoint", () => {
  it("settles legacy queues without reading, storing or forwarding their payload", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const request = new Proxy({}, { get: () => { throw new Error("Report must not be inspected"); } });
    const response = POST(request);
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("x-diagnostic-id")).toBe(false);
    expect(await response.text()).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });
});
