import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sourceFingerprint } from "../build-state.mjs";

const localFiles = ["AGENTS.md", "CLAUDE.md", "pnpm-lock.yaml"];
function fixture(git, run) {
  const root = mkdtempSync(join(tmpdir(), "studio-source-certificate-"));
  const command = args => execFileSync("git", args, { cwd: root, timeout: 5000, stdio: "ignore" });
  const write = (name, value = "synthetic fixture metadata") => writeFileSync(join(root, name), value);
  const fingerprint = () => sourceFingerprint(root, "https://fixture.invalid");
  try {
    write("package.json", "{}");
    if (git) command(["init", "--quiet"]);
    run({ root, command, write, fingerprint });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("untracked local metadata never changes a Git source certificate", () => fixture(true, ({ root, write, fingerprint }) => {
  const before = fingerprint();
  for (const name of localFiles) {
    write(name);
    assert.equal(fingerprint(), before, name);
    write(name, "changed synthetic local metadata");
    assert.equal(fingerprint(), before, name);
    rmSync(join(root, name));
    assert.equal(fingerprint(), before, name);
  }
}));

test("tracked instructions and lockfiles remain covered by the certificate", () => fixture(true, ({ command, write, fingerprint }) => {
  const before = fingerprint();
  for (const name of localFiles) write(name);
  command(["add", "--", ...localFiles]);
  assert.notEqual(fingerprint(), before);
  for (const name of localFiles) {
    const prior = fingerprint();
    write(name, "changed tracked fixture metadata");
    assert.notEqual(fingerprint(), prior, name);
  }
}));

test("arbitrary untracked project configuration remains covered", () => fixture(true, ({ write, fingerprint }) => {
  for (const name of ["postcss.config.mjs", "vitest.config.ts", ".dev.vars", "additional-policy.json"]) {
    const before = fingerprint();
    write(name, "synthetic project configuration");
    assert.notEqual(fingerprint(), before, name);
  }
}));

test("fixtures without a valid Git index retain metadata coverage", () => fixture(false, ({ root, write, fingerprint }) => {
  for (const invalidIndex of [false, true]) {
    if (invalidIndex) mkdirSync(join(root, ".git"));
    for (const name of localFiles) {
      const before = fingerprint();
      write(name, `synthetic metadata ${invalidIndex}`);
      assert.notEqual(fingerprint(), before, name);
      rmSync(join(root, name));
    }
  }
}));
