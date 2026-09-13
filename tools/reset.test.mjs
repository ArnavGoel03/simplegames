import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/reset/route";

describe("the self-contained reset escape", () => {
  it("clears only workers and Cache Storage, then returns home", async () => {
    const response = GET(); expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text(); expect(html).not.toContain('src=');
    const unregister = vi.fn(async () => true), remove = vi.fn(async () => true), replace = vi.fn(), clear = vi.fn();
    const script = html.match(/<script>([\s\S]+)<\/script>/)[1];
    const caches = { keys: async () => ["shell-old", "assets-old"], delete: remove };
    await vm.runInNewContext(script, { navigator: { serviceWorker: { getRegistrations: async () => [{ unregister }] } }, window: { caches }, caches, location: { replace }, localStorage: { clear }, sessionStorage: { clear } });
    expect(unregister).toHaveBeenCalledOnce(); expect(remove.mock.calls).toEqual([["shell-old"], ["assets-old"]]); expect(replace).toHaveBeenCalledExactlyOnceWith("/"); expect(clear).not.toHaveBeenCalled();
  });
  it("returns home if the browser refuses its storage APIs", async () => {
    const script = (await GET().text()).match(/<script>([\s\S]+)<\/script>/)[1]; const replace = vi.fn();
    await vm.runInNewContext(script, { navigator: { serviceWorker: { getRegistrations: async () => { throw new Error("denied"); } } }, window: {}, location: { replace } });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
  });
  it("still clears accessible caches when worker registration access fails", async () => {
    const script = (await GET().text()).match(/<script>([\s\S]+)<\/script>/)[1];
    const replace = vi.fn(), remove = vi.fn(async () => true);
    const caches = { keys: async () => ["shell-old"], delete: remove };
    await vm.runInNewContext(script, { navigator: { serviceWorker: { getRegistrations: async () => { throw new Error("denied"); } } }, window: { caches }, caches, location: { replace } });
    expect(remove).toHaveBeenCalledExactlyOnceWith("shell-old");
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
  });
});
