import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temporary = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function project() {
  const root = mkdtempSync(join(tmpdir(), "studio-deploy-test-"));
  temporary.push(root);
  for (const path of ["tools", "src/lib", "public", "bin"]) mkdirSync(join(root, path), { recursive: true });
  for (const file of ["cf.mjs", "site-url.mjs", "build-state.mjs", "html-policy.mjs", "build-info.mjs"]) {
    const source = new URL(file, import.meta.url);
    if (existsSync(source)) cpSync(source, join(root, "tools", file));
  }
  writeFileSync(join(root, "src/lib/brand.ts"), 'function resolveUrl() { return "https://glasstablegames.com"; }');
  writeFileSync(join(root, "package.json"), '{"type":"module","version":"0.3.0"}');
  cpSync(new URL("../public/sw.js", import.meta.url), join(root, "public/sw.js"));
  writeFileSync(join(root, "bin/opennextjs-cloudflare"), `#!/usr/bin/env node
import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
appendFileSync('calls.log', process.argv[2] + '\\n');
if (process.argv[2] === 'build') {
  mkdirSync('.next', { recursive: true });
  mkdirSync('.open-next/assets', { recursive: true });
  writeFileSync('.next/BUILD_ID', 'fixture-build');
  writeFileSync('.open-next/worker.js', 'worker');
  copyFileSync('public/sw.js', '.open-next/assets/sw.js');
  if (process.env.TEST_MUTATE_BUILD) appendFileSync('src/lib/brand.ts', '\\n// changed during build');
  if (process.env.TEST_FAIL_BUILD) process.exit(1);
}
`, { mode: 0o755 });
  const run = (command, env = {}) => spawnSync(process.execPath, ["tools/cf.mjs", command], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: "https://glasstablegames.com", PATH: `${join(root, "bin")}:${process.env.PATH}`, ...env },
  });
  const calls = () => existsSync(join(root, "calls.log")) ? readFileSync(join(root, "calls.log"), "utf8").trim().split("\n") : [];
  return { root, run, calls };
}

describe("the Cloudflare command wrapper", () => {
  it("refuses deployment without a verified build before calling the adapter", () => {
    const p = project();
    expect(p.run("deploy").status).toBe(1);
    expect(p.calls()).toEqual([]);
  });

  it("stamps the generated worker and deploys an unchanged successful build", () => {
    const p = project();
    const source = readFileSync(join(p.root, "public/sw.js"), "utf8");
    expect(p.run("build").status).toBe(0);
    expect(readFileSync(join(p.root, ".open-next/assets/sw.js"), "utf8")).toContain("fixture-build");
    expect(readFileSync(join(p.root, "public/sw.js"), "utf8")).toBe(source);
    expect(p.run("deploy").status).toBe(0);
    expect(p.calls()).toEqual(["build", "deploy"]);
  });

  it.each(["deploy", "upload", "preview"])("refuses stale source before %s", (command) => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    writeFileSync(join(p.root, "public/new-art.svg"), "changed art");
    expect(p.run(command).status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it("refuses a build made for a different canonical origin", () => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    expect(p.run("deploy", { NEXT_PUBLIC_SITE_URL: "https://preview.example.com" }).status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it("does not certify a source tree changed during the build", () => {
    const p = project();
    expect(p.run("build", { TEST_MUTATE_BUILD: "1" }).status).toBe(1);
    expect(p.run("deploy").status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it.each(["worker.js", "worker-no-transform.js"])("refuses an altered %s entry", (entry) => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    writeFileSync(join(p.root, ".open-next", entry), "substituted");
    expect(p.run("deploy").status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it("invalidates the old certification before a failed rebuild", () => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    expect(p.run("build", { TEST_FAIL_BUILD: "1" }).status).toBe(1);
    expect(p.run("deploy").status).toBe(1);
    expect(p.calls()).toEqual(["build", "build"]);
  });
});
