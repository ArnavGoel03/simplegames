import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInfo } from "./build-info.mjs";

const temporary = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

function project() {
  const root = mkdtempSync(join(tmpdir(), "studio-build-info-"));
  temporary.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.3.0" }));
  return root;
}

describe("release metadata", () => {
  it("reads the package version and preserves the wrapper's fixed timestamp", () => {
    const root = project();
    const env = { NEXT_PUBLIC_APP_COMMIT: "a".repeat(40), NEXT_PUBLIC_APP_BUILT_AT: "2026-09-13T01:00Z" };
    expect(buildInfo(root, env, new Date("2027-01-01T00:00:00Z"))).toEqual({
      NEXT_PUBLIC_APP_ENVIRONMENT: "development", NEXT_PUBLIC_APP_VERSION: "0.3.0", ...env,
    });
  });

  it("resolves a packed checkout revision and stamps UTC once", () => {
    const root = project();
    mkdirSync(join(root, ".git", "objects"), { recursive: true });
    mkdirSync(join(root, ".git", "refs"), { recursive: true });
    writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/release\n");
    writeFileSync(join(root, ".git", "packed-refs"), `${"b".repeat(40)} refs/heads/release\n`);
    expect(buildInfo(root, {}, new Date("2026-09-13T06:30:59+05:30"))).toEqual({
      NEXT_PUBLIC_APP_ENVIRONMENT: "development", NEXT_PUBLIC_APP_VERSION: "0.3.0", NEXT_PUBLIC_APP_COMMIT: "b".repeat(40), NEXT_PUBLIC_APP_BUILT_AT: "2026-09-13T01:00Z",
    });
  });

  it("omits an unavailable source revision instead of inventing one", () => {
    expect(buildInfo(project(), {}, new Date("2026-09-13T01:00:00Z")).NEXT_PUBLIC_APP_COMMIT).toBe("");
  });

  it("marks Cloudflare production and preview explicitly, independent of NODE_ENV", () => {
    const root = project();
    expect(buildInfo(root, { CLOUDFLARE_BUILD: "production", NODE_ENV: "development" }).NEXT_PUBLIC_APP_ENVIRONMENT).toBe("production");
    expect(buildInfo(root, { CLOUDFLARE_BUILD: "preview", NODE_ENV: "production" }).NEXT_PUBLIC_APP_ENVIRONMENT).toBe("preview");
    expect(buildInfo(root, { NODE_ENV: "production" }).NEXT_PUBLIC_APP_ENVIRONMENT).toBe("development");
  });
  it("rejects malformed public build metadata", () => {
    const root = project();
    expect(() => buildInfo(root, { NEXT_PUBLIC_APP_COMMIT: "not-a-revision" })).toThrow("Invalid build revision");
    expect(() => buildInfo(root, { NEXT_PUBLIC_APP_BUILT_AT: "not-a-date" })).toThrow("Invalid build timestamp");
  });
});
