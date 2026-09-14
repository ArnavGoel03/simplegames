import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fetchGlassSource, GLASS_SOURCE_LIMIT, mirrorGlassSource, validateGlassSource } from "./glass-mirror.mjs";

const canonical = readFileSync(new URL("../src/app/glass.css", import.meta.url));
const temporary = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe("canonical glass mirror", () => {
  it("preserves exact bytes and rejects a same-size changed material", () => {
    const directory = mkdtempSync(join(tmpdir(), "glass-mirror-"));
    temporary.push(directory);
    const path = join(directory, "glass.css");
    const source = Buffer.from(canonical.toString().replaceAll("\n", "\r\n"));
    mirrorGlassSource(source, path);
    expect(readFileSync(path).equals(source)).toBe(true);
    mirrorGlassSource(source, path, true);
    const changed = Buffer.from(source);
    changed[changed.indexOf("16px")] = "2".charCodeAt(0);
    writeFileSync(path, changed);
    expect(() => mirrorGlassSource(source, path, true)).toThrow("differs");
  });

  it.each([
    ["empty", Buffer.alloc(0)],
    ["HTML", Buffer.from("<!doctype html><html>not CSS</html>")],
    ["oversize", Buffer.alloc(GLASS_SOURCE_LIMIT + 1)],
    ["invalid UTF-8", Buffer.concat([canonical, Buffer.from([0xff])])],
    ["missing variable", Buffer.from(canonical.toString().replace("--gtg-glass-blur", "--gtg-glass-missing"))],
    ["remote import", Buffer.concat([Buffer.from('@import "https://example.com/glass.css";\n'), canonical])],
    ["remote URL", Buffer.from(canonical.toString().replace("16px", "url(https://example.com/glass.css)"))],
    ["escaped URL", Buffer.from(canonical.toString().replace("16px", "u\\72l(https://example.com/glass.css)"))],
    ["duplicate variable", Buffer.from(canonical.toString().replace("--gtg-glass-angle", "--gtg-glass-blur"))],
  ])("rejects %s before modifying the existing mirror", (_kind, source) => {
    const directory = mkdtempSync(join(tmpdir(), "glass-invalid-"));
    temporary.push(directory);
    const path = join(directory, "glass.css");
    writeFileSync(path, canonical);
    expect(() => mirrorGlassSource(source, path)).toThrow();
    expect(readFileSync(path).equals(canonical)).toBe(true);
  });

  it("fetches the same source origin with bounded transport and returns original bytes", async () => {
    expect(validateGlassSource(canonical)).toBe(canonical);
    const source = await fetchGlassSource("http://127.0.0.1:3210/some/path", async (url, options) => {
      expect(url.href).toBe("http://127.0.0.1:3210/glass-source.css");
      expect(options.redirect).toBe("manual");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return new Response(canonical, { headers: { "content-type": "text/css; charset=utf-8" } });
    });
    expect(source.equals(canonical)).toBe(true);
  });

  it.each([
    ["redirect", () => new Response(null, { status: 302, headers: { location: "https://example.com/glass.css" } })],
    ["HTML response", () => new Response(canonical, { headers: { "content-type": "text/html" } })],
    ["oversize declared response", () => new Response(canonical, { headers: { "content-type": "text/css", "content-length": String(GLASS_SOURCE_LIMIT + 1) } })],
  ])("rejects %s at the fetch boundary", async (_kind, response) => {
    await expect(fetchGlassSource("https://example.com", async () => response())).rejects.toThrow();
  });

  it("cancels an oversized stream without reading its remainder", async () => {
    let cancelled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(canonical);
        controller.enqueue(new Uint8Array(GLASS_SOURCE_LIMIT));
      },
      cancel() { cancelled = true; },
    });
    await expect(fetchGlassSource("https://example.com", async () => new Response(body, {
      headers: { "content-type": "text/css" },
    }))).rejects.toThrow("exceeds limit");
    expect(cancelled).toBe(true);
  });
});
