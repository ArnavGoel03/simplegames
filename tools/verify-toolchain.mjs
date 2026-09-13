import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const require = createRequire(new URL("../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("package.json", root)));
const compat = JSON.parse(readFileSync(new URL("tools/eslint-compat/package.json", root)));
assert.equal(compat.dependencies["eslint-config-next"], manifest.dependencies.next);
assert.equal(compat.dependencies.typescript, manifest.overrides["eslint-config-next"].typescript);
const compiler = require("typescript/package.json");
assert.equal(compiler.version, manifest.devDependencies.typescript);
const compilerPath = join(dirname(require.resolve("typescript/package.json")), compiler.bin.tsc);
const adapter = createRequire(require.resolve("@glasstable/eslint-compat"));
const config = createRequire(adapter.resolve("eslint-config-next/core-web-vitals"));
const parser = createRequire(config.resolve("@typescript-eslint/parser"));
assert.equal(parser("typescript/package.json").version, compat.dependencies.typescript);
assert.equal(typeof parser("typescript").createSourceFile, "function");

// Prove that the selected compiler rejects an error, not merely that it runs.
const fixture = mkdtempSync(join(tmpdir(), "gtg-compiler-"));
try {
  writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [], lib: ["es2022"] }, files: ["index.ts"] }));
  const check = () => spawnSync(process.execPath, [compilerPath, "-p", fixture], { encoding: "utf8", timeout: 15_000 });
  writeFileSync(join(fixture, "index.ts"), "const value: string = 1;\n");
  const rejected = check();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stdout, /TS2322/);
  writeFileSync(join(fixture, "index.ts"), 'const value: string = "valid";\n');
  const accepted = check();
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.equal(accepted.stderr, "");
} finally { rmSync(fixture, { recursive: true, force: true }); }
console.log("Native compiler, calibrated rejection, and isolated ESLint compiler API verified");
