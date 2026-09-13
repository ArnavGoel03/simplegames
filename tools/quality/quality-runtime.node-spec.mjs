import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { machine, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { certifyGate, checkGateMetrics, digest, phaseClock, promoteCandidate, readJson, receiptPath, recordRelease, requireGate, requireRelease, runRecorded, writeJson } from "./quality-runtime.mjs";

const head = "a".repeat(40);
const sha = "b".repeat(64);
const uuid = "12345678-1234-1234-1234-123456789abc";
const previousId = "22345678-1234-1234-1234-123456789abc";
const identity = { sourceHead: head, sourceFingerprint: sha };
const candidate = { schema: 1, kind: "candidate", site: "board", worker: "board", ...identity, buildSource: sha, buildOutput: sha, candidateVersion: uuid, origin: "https://candidate.example.test", upload: { exitCode: 0, signal: null, logDigest: sha } };
const ci = { repository: "owner/harness", workflow: ".github/workflows/visual.yml" };
const report = (engine) => ({ ...candidate, browsers: [{ engine, observedSourceHead: head, checks: [{ id: "startup", status: "passed" }], measurements: [{ id: "startup", unit: "ms", samples: [80, 100, 120] }] }] });

async function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "gtg-quality-"));
  const policy = {
    schema: 1, ci,
    gateMetrics: [{ id: "typecheck", unit: "ms", limit: 2000, baseline: { sourceHead: head, value: 100, evidence: "docs/quality/baseline.json" } }],
    sites: { board: { checks: ["startup"], metrics: [{ id: "startup", unit: "ms", statistic: "median", limit: 200, baseline: { sourceHead: head, runId: 1, artifactId: 2, value: 100 } }] } },
  };
  const baseline = (executable = "pnpm") => writeJson(join(root, "docs/quality/baseline.json"), { schema: 1, sourceHead: head, command: `${executable} run typecheck`, milliseconds: 100, exitCode: 0, limitMilliseconds: 2000, limitReason: "Fixture calibration", environment: { system: platform(), machine: machine(), node: process.versions.node } });
  const gate = () => {
    writeJson(receiptPath(root, "gate.log"), "completed");
    writeJson(receiptPath(root, "gate.json"), { schema: 1, kind: "gate", ...identity, measurements: [{ id: "typecheck", unit: "ms", samples: [100] }], outcome: { exitCode: 0, signal: null, error: null, command: ["pnpm", "run", "gate"], logDigest: digest(readFileSync(receiptPath(root, "gate.log"))) } });
  };
  baseline();
  writeJson(join(root, "package.json"), { name: "fixture", version: "1.0.0" });
  try { return await run({ root, policy, baseline, gate }); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("phase timer recognizes only the root package and measures typecheck once", () => {
  const timer = phaseClock({ name: "fixture", version: "1.0.0" });
  timer.line("> fixture@1.0.0 gate /repo", 0);
  timer.line("> fixture@1.0.0 typecheck /repo", 10);
  timer.line("> child@1.0.0 typecheck /repo/apps/child", 20);
  timer.line("> fixture@1.0.0 lint /repo", 110);
  assert.deepEqual(timer.finish(150), [{ id: "typecheck", unit: "ms", samples: [100] }, { id: "lint", unit: "ms", samples: [40] }]);
});

test("phase timer recognizes pnpm 12 command markers from package scripts", () => {
  const timer = phaseClock({ name: "fixture", version: "1.0.0", scripts: { gate: "pnpm typecheck && pnpm lint && pnpm test", typecheck: "pnpm -r typecheck", lint: "pnpm -r run lint --max-warnings=0", test: "pnpm -r test" } });
  timer.line("$ pnpm typecheck && pnpm lint && pnpm test", 0);
  timer.line("$ pnpm -r typecheck", 10);
  timer.line("packages/engine typecheck$ tsc --noEmit", 20);
  timer.line("packages/engine typecheck: Done", 50);
  timer.line("$ pnpm -r run lint --max-warnings=0", 110);
  timer.line("$ pnpm -r test", 150);
  assert.deepEqual(timer.finish(200), [{ id: "typecheck", unit: "ms", samples: [100] }, { id: "lint", unit: "ms", samples: [40] }, { id: "test", unit: "ms", samples: [50] }]);
});

test("gate metric rejects slow, missing, duplicate and mismatched baseline records", () => fixture(({ root, policy }) => {
  const measured = [{ id: "typecheck", unit: "ms", samples: [100] }];
  assert.equal(checkGateMetrics(root, policy, measured, ["pnpm"])[0].actual, 100);
  assert.throws(() => checkGateMetrics(root, policy, [], ["pnpm"]));
  assert.throws(() => checkGateMetrics(root, policy, [...measured, ...measured], ["pnpm"]));
  assert.throws(() => checkGateMetrics(root, policy, [{ ...measured[0], samples: [2001] }], ["pnpm"]), /exceeding/);
  const wrong = structuredClone(policy);
  wrong.gateMetrics[0].baseline.value = 999;
  assert.throws(() => checkGateMetrics(root, wrong, measured, ["pnpm"]), /baseline/);
}));

test("successful gate records actual command/log and failed rerun removes success", () => fixture(async ({ root, policy, baseline }) => {
  baseline(process.execPath);
  const command = [process.execPath, "-e", 'console.log("> fixture@1.0.0 typecheck"); console.log("> fixture@1.0.0 lint");'];
  const receipt = await certifyGate({ root, command, policy, identity: () => identity, display: false });
  assert.equal(receipt.outcome.exitCode, 0);
  assert.equal(receipt.measurements[0].id, "typecheck");
  assert.doesNotThrow(() => requireGate(root, identity, command, policy));
  assert.throws(() => requireGate(root, { ...identity, sourceFingerprint: "c".repeat(64) }, command, policy), /stale/);
  await assert.rejects(certifyGate({ root, command: [process.execPath, "-e", "process.exit(7)"], policy, identity: () => identity, display: false }), /gate failed/);
  assert.equal(existsSync(receiptPath(root, "gate.json")), false);
  assert.equal(readJson(receiptPath(root, "gate-attempt.json")).outcome.exitCode, 7);
}));

test("source changes and actual tool warnings prevent a successful receipt", () => fixture(async ({ root, policy, baseline }) => {
  baseline(process.execPath);
  const code = 'console.log("> fixture@1.0.0 typecheck"); console.log("> fixture@1.0.0 lint");';
  let calls = 0;
  await assert.rejects(certifyGate({ root, command: [process.execPath, "-e", code], policy, identity: () => ({ ...identity, sourceFingerprint: calls++ ? "c".repeat(64) : sha }), display: false }), /source changed/);
  await assert.rejects(certifyGate({ root, command: [process.execPath, "-e", `${code} console.warn("ExperimentalWarning: fixture");`], policy, identity: () => identity, display: false }), /warnings/);
  assert.equal(existsSync(receiptPath(root, "gate.json")), false);
}));

test("idle commands fail with an interrupted outcome", () => fixture(async ({ root }) => {
  const outcome = await runRecorded(process.execPath, ["-e", "setInterval(() => {}, 10000)"], { cwd: root, log: join(root, "idle.log"), idleMs: 100, display: false });
  assert.notEqual(outcome.exitCode, 0);
  assert.match(outcome.error, /no output/);
}));

test("release assembly uses verified artifacts, computes baselines and refuses stale policy", () => fixture(({ root, policy, gate }) => {
  gate();
  const references = [{ runId: 1, artifactId: 2 }, { runId: 3, artifactId: 4 }];
  const fetchArtifact = (trusted, runId, artifactId) => ({ lookup: { repository: trusted.repository, workflow: trusted.workflow, runId, artifactId, artifactDigest: `sha256:${sha}` }, evidence: { schema: 1, reports: [report(runId === 1 ? "chromium" : "webkit")] } });
  const receipt = recordRelease({ root, site: "board", candidate, policy, references, fetchArtifact });
  assert.equal(receipt.ci.length, 2);
  assert.equal(receipt.verified[1].measurements[0].actual, 100);
  writeJson(receiptPath(root, "candidates/board.json"), candidate);
  const parameters = { root, site: "board", identity, command: ["pnpm", "run", "gate"], expectedCandidate: { worker: "board" }, policy };
  assert.equal(requireRelease(parameters).candidate.candidateVersion, uuid);
  assert.throws(() => requireRelease({ ...parameters, policy: { ...policy, changed: true } }), /stale/);
  const wrong = structuredClone(policy);
  wrong.sites.board.metrics[0].baseline.value = 999;
  assert.throws(() => recordRelease({ root, site: "board", candidate, policy: wrong, references, fetchArtifact }), /baseline does not match/);
  assert.throws(() => recordRelease({ root, site: "board", candidate, policy, references: [references[0]], fetchArtifact }), /both Chromium/);
}));

test("promotion verifies immutable candidate, rollback and resulting deployment", () => fixture(async ({ root }) => {
  let promoted = false;
  let validations = 0;
  const seen = [];
  const query = (args) => {
    seen.push(args);
    if (args[0] === "versions") return { id: args[2], resources: { bindings: [{ type: "secret_text", name: "DATABASE_URL" }] } };
    return [{ id: promoted ? "after" : "before", created_on: "2026-09-13T00:00:00Z", versions: [{ version_id: promoted ? uuid : previousId, percentage: 100 }] }];
  };
  const attempt = await promoteCandidate({ root, site: "board", cwd: root, validate: () => { validations++; return { candidate }; }, requiredSecrets: ["DATABASE_URL"], query, run: async (command, args) => {
    assert.deepEqual([command, ...args], ["wrangler", "versions", "deploy", `${uuid}@100%`, "--name", "board", "--yes"]);
    promoted = true;
    return { exitCode: 0, signal: null, error: null, logDigest: sha, output: "deployed" };
  } });
  assert.equal(validations, 2);
  assert.equal(attempt.previous.versions[0].version_id, previousId);
  assert.equal(attempt.observedDeployment.versions[0].version_id, uuid);
  assert.ok(seen.some((args) => args[2] === previousId));
  assert.equal(readdirSync(receiptPath(root, "deployments")).length, 1);
}));

test("missing remote candidate secrets prevents any production mutation", () => fixture(async ({ root }) => {
  let mutations = 0;
  await assert.rejects(promoteCandidate({ root, site: "board", cwd: root, validate: () => ({ candidate }), requiredSecrets: ["DATABASE_URL"], query: () => ({ id: uuid, resources: { bindings: [] } }), run: async () => { mutations++; } }), /missing required secret/);
  assert.equal(mutations, 0);
}));

test("a candidate changed during provider lookup cannot be promoted", () => fixture(async ({ root }) => {
  let validations = 0;
  let mutations = 0;
  const query = (args) => args[0] === "versions" ? { id: args[2] } : [{ id: "before", created_on: "2026-09-13T00:00:00Z", versions: [{ version_id: previousId, percentage: 100 }] }];
  await assert.rejects(promoteCandidate({ root, site: "board", cwd: root, validate: () => ({ candidate: validations++ ? { ...candidate, sourceFingerprint: "c".repeat(64) } : candidate }), query, run: async () => { mutations++; } }), /changed during production preflight/);
  assert.equal(mutations, 0);
}));

test("an interrupted promotion retains its rollback receipt without claiming success", () => fixture(async ({ root }) => {
  const query = (args) => args[0] === "versions" ? { id: args[2] } : [{ id: "before", created_on: "2026-09-13T00:00:00Z", versions: [{ version_id: previousId, percentage: 100 }] }];
  await assert.rejects(promoteCandidate({ root, site: "board", cwd: root, validate: () => ({ candidate }), query, run: async () => ({ exitCode: null, signal: "SIGTERM", error: "interrupted", logDigest: sha }) }), /interrupted/);
  const [file] = readdirSync(receiptPath(root, "deployments"));
  const attempt = readJson(receiptPath(root, "deployments", file));
  assert.equal(attempt.previous.versions[0].version_id, previousId);
  assert.equal(attempt.outcome.signal, "SIGTERM");
  assert.equal(attempt.observedDeployment, undefined);
}));

test("a recording callback failure stops the detached command", async () => fixture(async ({ root }) => {
  const result = await runRecorded(process.execPath, ["-e", "console.log('ready');setInterval(()=>{},1000)"], {
    cwd: root, log: receiptPath(root, "recording-failure.log"), display: false,
    onLine: () => { throw new Error("recording unavailable"); },
  });
  assert.match(result.error, /recording failed: recording unavailable/);
  assert.notEqual(result.exitCode, 0);
  assert.ok(result.durationMs < 3000);
}));
