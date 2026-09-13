import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PWA_FILES, mirrorPwaSource, validatePwaSource } from "./pwa-mirror.mjs";

const temporary = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
function bundle() {
  return { schema: 1, files: PWA_FILES.map(name => {
    const source = readFileSync(new URL(`../src/lib/pwa/${name}`, import.meta.url), "utf8");
    return { name, source, sha256: createHash("sha256").update(source).digest("hex") };
  }) };
}
describe("canonical PWA mirror", () => {
  it("matches the checked-in receipt and preserves every source byte", () => {
    const source = bundle();
    mirrorPwaSource(source, new URL("../src/lib/pwa", import.meta.url).pathname, true);
    const path = mkdtempSync(join(tmpdir(), "pwa-mirror-")); temporary.push(path); mirrorPwaSource(source, path);
    for (const file of source.files) expect(readFileSync(join(path, file.name), "utf8")).toBe(file.source);
  });
  it.each(["unknown", "duplicate", "missing", "hash", "oversize", "schema"])("rejects %s before writing any source", kind => {
    const source = bundle();
    if (kind === "unknown") source.files[0].name = "../outside.ts";
    if (kind === "duplicate") source.files[0].name = source.files[1].name;
    if (kind === "missing") source.files.pop();
    if (kind === "hash") source.files[0].source += "\n";
    if (kind === "oversize") source.files[0].source = "a".repeat(200001);
    if (kind === "schema") source.schema = 2;
    expect(() => validatePwaSource(source)).toThrow();
  });
});
