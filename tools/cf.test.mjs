import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { sourceFingerprint } from "./build-state.mjs";
import { outputFingerprint, sourceFingerprint } from "./build-state.mjs";

const temporary = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function project() {
  const root = mkdtempSync(join(tmpdir(), "studio-deploy-test-"));
  temporary.push(root);
  for (const path of ["tools", "src/lib", "public", "bin", ".audit"]) mkdirSync(join(root, path), { recursive: true });
  symlinkSync(new URL("../node_modules", import.meta.url), join(root, "node_modules"), "dir");
  for (const file of ["cf.mjs", "site-url.mjs", "build-state.mjs", "html-policy.mjs", "build-info.mjs", "release-context.mjs"]) {
    const source = new URL(file, import.meta.url);
    if (existsSync(source)) cpSync(source, join(root, "tools", file));
  }
  cpSync(new URL("./quality", import.meta.url), join(root, "tools/quality"), { recursive: true });
  writeFileSync(join(root, "wrangler.jsonc"), '{"name":"glasstablegames"}');
  writeFileSync(join(root, "tools/generate-worker.mjs"), "export async function writeServiceWorker() {}\n");
  writeFileSync(join(root, "src/lib/brand.ts"), 'function resolveUrl() { return "https://glasstablegames.com"; }');
  writeFileSync(join(root, "package.json"), '{"type":"module","version":"0.3.0"}');
  cpSync(new URL("../public/sw.js", import.meta.url), join(root, "public/sw.js"));
  writeFileSync(join(root, "bin/opennextjs-cloudflare"), `#!/usr/bin/env node
import { appendFileSync, copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
appendFileSync('.audit/calls.log', process.argv[2] + '\\n');
if (process.argv[2] === 'upload') {
  cpSync('.open-next/cache', '.open-next/assets/cdn-cgi/_next_cache', { recursive: true });
  if (process.env.TEST_MUTATE_UPLOAD) writeFileSync('.open-next/worker.js', 'substituted during upload');
  if (process.env.TEST_MUTATE_UPLOAD === 'stamp') {
    const { outputFingerprint } = await import('../tools/build-state.mjs');
    const stamp = JSON.parse(readFileSync('.open-next/build-state.json', 'utf8'));
    stamp.outputHash = outputFingerprint(process.cwd());
    writeFileSync('.open-next/build-state.json', JSON.stringify(stamp));
  }
  console.log('Worker Version ID: 12345678-1234-1234-1234-123456789abc');
}
if (process.argv[2] === 'build') {
  mkdirSync('.next', { recursive: true });
  mkdirSync('.open-next/assets', { recursive: true });
  mkdirSync('.open-next/.build', { recursive: true });
  mkdirSync('.open-next/cache/fixture-build', { recursive: true });
  writeFileSync('.open-next/.build/open-next.config.edge.mjs', 'export default { default: { override: { incrementalCache: "cf-static-assets-incremental-cache", tagCache: "dummy" } } };');
  writeFileSync('.open-next/cache/fixture-build/index.cache', '{"html":"prepared by OpenNext"}');
  writeFileSync('.next/BUILD_ID', 'fixture-build');
  writeFileSync('.open-next/worker.js', 'worker');
  copyFileSync('public/sw.js', '.open-next/assets/sw.js');
  if (process.env.TEST_MUTATE_BUILD) appendFileSync('src/lib/brand.ts', '\\n// changed during build');
  if (process.env.TEST_FAIL_BUILD) process.exit(1);
}
`, { mode: 0o755 });
  for (const args of [["init", "--quiet"], ["add", "tools", "src", "public", "package.json", "wrangler.jsonc"], ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"]]) {
    expect(spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 5000 }).status).toBe(0);
  }
  const run = (command, env = {}, args = []) => spawnSync(process.execPath, ["tools/cf.mjs", command, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: "https://glasstablegames.com", PATH: `${join(root, "bin")}:${process.env.PATH}`, ...env },
  });
  const calls = () => existsSync(join(root, ".audit/calls.log")) ? readFileSync(join(root, ".audit/calls.log"), "utf8").trim().split("\n") : [];
  return { root, run, calls };
}

describe("the Cloudflare command wrapper", () => {
  it("refuses deployment without a verified build before calling the adapter", () => {
    const p = project();
    expect(p.run("upload").status).toBe(1);
    expect(p.calls()).toEqual([]);
  });

  it("stamps the generated worker and uploads an unchanged successful build", () => {
    const p = project();
    const source = readFileSync(join(p.root, "public/sw.js"), "utf8");
    expect(p.run("build").status).toBe(0);
    expect(readFileSync(join(p.root, ".open-next/assets/sw.js"), "utf8")).toContain("fixture-build");
    expect(readFileSync(join(p.root, "public/sw.js"), "utf8")).toBe(source);
    expect(p.run("upload").status).toBe(0);
    expect(p.calls()).toEqual(["build", "upload"]);
    const candidate = JSON.parse(readFileSync(join(p.root, ".audit/quality/candidates/studio.json"), "utf8"));
    expect(candidate.candidateVersion).toBe("12345678-1234-1234-1234-123456789abc");
    expect(candidate.buildOutput).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.buildOutput).toBe(outputFingerprint(p.root));
    expect(p.run("deploy").status).toBe(1);
    expect(p.calls()).toEqual(["build", "upload"]);
  });

  it("prepares the actual OpenNext static cache before certification and can upload twice", () => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    const prepared = join(p.root, ".open-next/assets/cdn-cgi/_next_cache/fixture-build/index.cache");
    expect(readFileSync(prepared, "utf8")).toBe('{"html":"prepared by OpenNext"}');
    const certified = outputFingerprint(p.root);
    expect(p.run("upload").status).toBe(0);
    expect(outputFingerprint(p.root)).toBe(certified);
    expect(p.run("upload").status).toBe(0);
    expect(outputFingerprint(p.root)).toBe(certified);
  });

  it.each([["--skipNextBuild"], ["--skipBuild"], ["-s"], ["--openNextConfigPath", "alternate.ts"]])("refuses build override %j before calling OpenNext", (...args) => {
    const p = project();
    expect(p.run("build", {}, args).status).toBe(1);
    expect(p.calls()).toEqual([]);
  });

  it.each([{ SKIP_NEXT_APP_BUILD: "yes" }, { CLOUDFLARE_ENV: "other" }, { NEXTJS_ENV: "test" },
    { NEXT_PUBLIC_APP_COMMIT: "a".repeat(40) }, { NEXT_PUBLIC_APP_ENVIRONMENT: "development" }])("refuses an inherited build or target override %j", (env) => {
    const p = project();
    expect(p.run("build", env).status).toBe(1);
    expect(p.calls()).toEqual([]);
  });

  it.each(["1", "stamp"])("refuses output changed during upload without writing a candidate receipt (%s)", (mutation) => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    expect(p.run("upload", { TEST_MUTATE_UPLOAD: mutation }).status).toBe(1);
    expect(existsSync(join(p.root, ".audit/quality/candidates/studio.json"))).toBe(false);
  });

  it.each(["postcss.config.mjs", "vitest.config.ts", ".dev.vars", "additional-policy.json", ".github/workflows/visual.yml"])("includes added root configuration in source identity: %s", (file) => {
    const p = project();
    const before = sourceFingerprint(p.root, "https://glasstablegames.com");
    expect(sourceFingerprint(p.root, "https://glasstablegames.com")).toBe(before);
    mkdirSync(join(p.root, file, ".."), { recursive: true });
    writeFileSync(join(p.root, file), "changed configuration");
    expect(sourceFingerprint(p.root, "https://glasstablegames.com")).not.toBe(before);
    expect(p.calls()).toEqual([]);
  });

  it("refuses a changed public build environment", () => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    expect(p.run("upload", { NEXT_PUBLIC_NEW_SETTING: "altered" }).status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
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
    expect(p.run("upload").status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it.each(["worker.js", "worker-no-transform.js"])("refuses an altered %s entry", (entry) => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    writeFileSync(join(p.root, ".open-next", entry), "substituted");
    expect(p.run("upload").status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it.each(["assets/_next/static/chunks/game.css", "assets/_next/static/chunks/game.js", "server-functions/default/handler.mjs"])("refuses substituted generated output %s", (entry) => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    const target = join(p.root, ".open-next", entry);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, "substituted");
    expect(p.run("upload").status).toBe(1);
    expect(p.calls()).toEqual(["build"]);
  });

  it("invalidates the old certification before a failed rebuild", () => {
    const p = project();
    expect(p.run("build").status).toBe(0);
    expect(p.run("build", { TEST_FAIL_BUILD: "1" }).status).toBe(1);
    expect(p.run("upload").status).toBe(1);
    expect(p.calls()).toEqual(["build", "build"]);
  });
});

it("source certificates track the worker generator, not its derived public output", () => {
  const p = project();
  const before = sourceFingerprint(p.root, "https://glasstablegames.com");
  writeFileSync(join(p.root, "public/sw.js"), "new generated attribution");
  expect(sourceFingerprint(p.root, "https://glasstablegames.com")).toBe(before);
  writeFileSync(join(p.root, "tools/generate-worker.mjs"), "changed canonical generator");
  expect(sourceFingerprint(p.root, "https://glasstablegames.com")).not.toBe(before);
});
