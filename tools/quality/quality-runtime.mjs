// Receipt I/O and bounded commands, shared unchanged with the studio adapter.
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { machine, platform, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { SHA256, SOURCE_HEAD, latestDeployment, measuredValue, sitePolicy, validateCandidate, validateCILookup, validateEvidence } from "./release-policy.mjs";

export const digest = (value) => createHash("sha256").update(value).digest("hex");
export const receiptPath = (root, ...parts) => join(root, ".audit", "quality", ...parts);

export function commandOutcome({ command, startedAt, durationMs, exitCode, signal, error, logDigest }) {
  return { command, startedAt, durationMs, exitCode, signal, error, logDigest };
}

export function readJson(path, maximum = 1024 * 1024) {
  if (statSync(path).size > maximum) throw new Error(`release: receipt exceeds ${maximum} bytes`);
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const pending = `${path}.${process.pid}.tmp`;
  writeFileSync(pending, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(pending, path);
}

export function sourceHead(root) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 10000 }).trim();
  if (!SOURCE_HEAD.test(head)) throw new Error("release: cannot identify source HEAD");
  return head;
}

/** An idle child is killed with its descendants; a signal never means success. */
export async function runRecorded(command, args, { cwd, env = process.env, log, idleMs = 30000, display = true, onLine = () => {} }) {
  mkdirSync(dirname(log), { recursive: true });
  writeFileSync(log, "", { mode: 0o600 });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
  let lastOutput = Date.now();
  let bytes = 0;
  let stopped = null;
  let killTimer;
  const kill = (signal) => {
    try { if (process.platform === "win32") child.kill(signal); else process.kill(-child.pid, signal); } catch { /* The child may already have exited. */ }
  };
  const stop = (reason) => {
    if (stopped) return;
    stopped = reason;
    kill("SIGTERM");
    killTimer = setTimeout(() => kill("SIGKILL"), 2000);
    killTimer.unref();
  };
  const partial = { stdout: "", stderr: "" };
  for (const name of ["stdout", "stderr"]) child[name].on("data", (chunk) => {
    lastOutput = Date.now();
    bytes += chunk.length;
    if (bytes > 32 * 1024 * 1024) { stop("command output exceeded 32 MiB"); return; }
    try {
      appendFileSync(log, chunk);
      if (display) process[name].write(chunk);
      const lines = `${partial[name]}${chunk.toString()}`.split(/\r?\n/);
      partial[name] = lines.pop();
      for (const line of lines) onLine(line, performance.now() - started);
    } catch (error) {
      stop(`command recording failed: ${error.message}`);
    }
  });
  const idle = setInterval(() => { if (Date.now() - lastOutput > idleMs) stop(`command produced no output for ${idleMs} ms`); }, Math.min(idleMs, 1000));
  const interrupted = () => stop("command interrupted");
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  const outcome = await new Promise((resolve) => {
    child.once("error", (error) => { stopped = error.message; });
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });
  clearInterval(idle);
  process.removeListener("SIGINT", interrupted);
  process.removeListener("SIGTERM", interrupted);
  if (stopped) kill("SIGKILL");
  clearTimeout(killTimer);
  const output = readFileSync(log, "utf8");
  return { command: [command, ...args], startedAt, durationMs: Math.round(performance.now() - started), ...outcome, error: stopped, logDigest: digest(output), output };
}

export function phaseClock(packageInfo) {
  const prefix = `> ${packageInfo.name}@${packageInfo.version} `;
  const measurements = [];
  let active;
  const finish = (at) => {
    if (active && active.id !== "gate") measurements.push({ id: active.id, unit: "ms", samples: [Math.round(at - active.at)] });
    active = undefined;
  };
  return {
    line(raw, at) {
      const line = stripVTControlCharacters(raw);
      // npm and older pnpm print the package/script name. pnpm 12 prints the
      // actual command; resolve that against this package's canonical scripts.
      const matching = Object.entries(packageInfo.scripts ?? {}).filter(([, command]) => line === `$ ${command}`);
      const id = line.startsWith(prefix) ? line.slice(prefix.length).split(/\s/)[0] : matching.length === 1 ? matching[0][0] : undefined;
      if (!id) return;
      finish(at);
      active = { id, at };
    },
    finish(at) { finish(at); return measurements; },
  };
}

export function checkGateMetrics(root, policy, measurements, command) {
  if (!Array.isArray(policy?.gateMetrics) || !policy.gateMetrics.length || new Set(policy.gateMetrics.map((metric) => metric.id)).size !== policy.gateMetrics.length) throw new Error("release: missing measured gate phase policy");
  return policy.gateMetrics.map((budget) => {
    const reference = budget.baseline;
    const path = reference?.evidence;
    if (typeof path !== "string" || isAbsolute(path) || relative(root, join(root, path)).startsWith("..")) throw new Error("release: baseline must be a source-controlled project path");
    const baseline = readJson(join(root, path));
    if (budget.unit !== "ms" || !Number.isFinite(budget.limit) || budget.limit < 0 || baseline.schema !== 1 || baseline.exitCode !== 0 || baseline.command !== `${command[0]} run ${budget.id}` || baseline.sourceHead !== reference.sourceHead || !SOURCE_HEAD.test(baseline.sourceHead) || baseline.milliseconds !== reference.value || !Number.isFinite(reference.value) || reference.value < 0 || baseline.limitMilliseconds !== budget.limit || !baseline.limitReason) throw new Error(`release: invalid measured ${budget.id} baseline`);
    if (baseline.environment?.node !== process.versions.node || baseline.environment?.machine !== machine() || baseline.environment?.system?.toLowerCase() !== platform()) throw new Error(`release: ${budget.id} budget requires calibration on this Node/system/CPU environment`);
    const matching = measurements.filter((measurement) => measurement.id === budget.id);
    if (matching.length !== 1 || matching[0].unit !== "ms") throw new Error(`release: gate did not record exactly one ${budget.id} phase`);
    const actual = measuredValue(matching[0].samples, "max");
    if (actual > budget.limit) throw new Error(`release: ${budget.id} took ${actual} ms, exceeding measured budget ${budget.limit} ms`);
    return { id: budget.id, actual, limit: budget.limit, baselineDigest: digest(JSON.stringify(baseline)) };
  });
}

export async function certifyGate({ root, command, identity, policy, display = true }) {
  const path = receiptPath(root, "gate.json");
  rmSync(path, { force: true });
  const before = identity();
  const log = receiptPath(root, "gate.log");
  const phases = phaseClock(readJson(join(root, "package.json")));
  const result = await runRecorded(command[0], command.slice(1), { cwd: root, log, onLine: phases.line, display });
  const { output, ...outcome } = result;
  const receipt = { schema: 1, kind: "gate", ...before, outcome, measurements: phases.finish(result.durationMs), log: "gate.log" };
  writeJson(receiptPath(root, "gate-attempt.json"), receipt);
  if (result.exitCode !== 0 || result.signal !== null || result.error) throw new Error("release: canonical gate failed; no successful receipt written");
  // Lint itself uses --max-warnings=0. Node/tool warnings must also be fixed.
  if (/(?:Deprecation|Experimental)Warning\b|(?:^|\n)\s*(?:(?:WARN(?:ING)?|Warning|warning)\b|\[WARNING\])/m.test(stripVTControlCharacters(output))) throw new Error("release: canonical gate emitted warnings");
  receipt.verifiedMetrics = checkGateMetrics(root, policy, receipt.measurements, command);
  if (JSON.stringify(identity()) !== JSON.stringify(before)) throw new Error("release: source changed while the gate ran");
  writeJson(path, receipt);
  return receipt;
}

export function requireGate(root, identity, command, policy) {
  const gate = readJson(receiptPath(root, "gate.json"));
  if (gate.schema !== 1 || gate.kind !== "gate" || gate.sourceHead !== identity.sourceHead || gate.sourceFingerprint !== identity.sourceFingerprint || !SHA256.test(gate.sourceFingerprint) || gate.outcome?.exitCode !== 0 || gate.outcome.signal !== null || gate.outcome.error || JSON.stringify(gate.outcome.command) !== JSON.stringify(command)) throw new Error("release: canonical gate receipt is missing, failed or stale; run the quality gate");
  if (digest(readFileSync(receiptPath(root, "gate.log"))) !== gate.outcome.logDigest) throw new Error("release: canonical gate log changed");
  checkGateMetrics(root, policy, gate.measurements, command);
  return gate;
}

function ghJson(endpoint) {
  return JSON.parse(execFileSync("gh", ["api", "--hostname", "github.com", endpoint], { encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 }));
}

function fetchEvidence(ci, runId, artifactId) {
  if (!ci || !/^[\w.-]+\/[\w.-]+$/.test(ci.repository) || !Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(artifactId) || artifactId <= 0) throw new Error("release: invalid CI lookup");
  console.log(`release: checking CI run ${runId}, artifact ${artifactId}`);
  const run = ghJson(`repos/${ci.repository}/actions/runs/${runId}`);
  const artifact = ghJson(`repos/${ci.repository}/actions/artifacts/${artifactId}`);
  const lookup = validateCILookup(run, artifact, ci, runId, artifactId);
  const archive = execFileSync("gh", ["api", "--hostname", "github.com", `repos/${ci.repository}/actions/artifacts/${artifactId}/zip`], { timeout: 30000, maxBuffer: 64 * 1024 * 1024 });
  if (`sha256:${digest(archive)}` !== artifact.digest) throw new Error("release: downloaded CI artifact digest does not match GitHub");
  const directory = mkdtempSync(join(tmpdir(), "gtg-evidence-"));
  try {
    const path = join(directory, "artifact.zip");
    writeFileSync(path, archive);
    const files = execFileSync("unzip", ["-Z1", path], { encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024 }).trim().split("\n");
    const reports = files.filter((name) => /^(?:[\w.-]+\/)*release-evidence\.json$/.test(name));
    if (reports.length !== 1) throw new Error("release: CI artifact must contain exactly one release-evidence.json");
    const evidence = JSON.parse(execFileSync("unzip", ["-p", path, reports[0]], { encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024 }));
    if (evidence.schema !== 1 || !Array.isArray(evidence.reports)) throw new Error("release: invalid CI evidence envelope");
    return { lookup, evidence };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function recordRelease({ root, site, candidate, policy, references, fetchArtifact = fetchEvidence }) {
  const config = sitePolicy(policy, site);
  const cache = new Map();
  const fetch = (runId, artifactId) => {
    const key = `${runId}:${artifactId}`;
    if (!cache.has(key)) cache.set(key, fetchArtifact(policy.ci, runId, artifactId));
    return cache.get(key);
  };
  if (!Array.isArray(references) || references.length < 1 || references.length > 10 || new Set(references.map((ref) => `${ref.runId}:${ref.artifactId}`)).size !== references.length) throw new Error("release: supply unique CI run:artifact references");
  const primary = references.map(({ runId, artifactId }) => fetch(runId, artifactId));
  const reports = primary.flatMap((item) => item.evidence.reports);
  const verified = validateEvidence(reports, candidate, policy);
  // A baseline names actual CI measurements, not a hand-written high limit.
  const baselines = config.metrics.map((budget) => {
    const result = fetch(budget.baseline.runId, budget.baseline.artifactId);
    const samples = result.evidence.reports.filter((report) => report.site === site && report.sourceHead === budget.baseline.sourceHead).flatMap((report) => report.browsers ?? []).filter((browser) => browser.observedSourceHead === budget.baseline.sourceHead).flatMap((browser) => browser.measurements?.filter((metric) => metric.id === budget.id && metric.unit === budget.unit) ?? []);
    if (!samples.length || Math.max(...samples.map((metric) => measuredValue(metric.samples, budget.statistic, budget.minSamples ?? 1))) !== budget.baseline.value) throw new Error(`release: ${budget.id} baseline does not match its CI artifact`);
    return { id: budget.id, ...budget.baseline, lookup: result.lookup };
  });
  const receipt = { schema: 1, kind: "release", recordedAt: new Date().toISOString(), candidateDigest: digest(JSON.stringify(candidate)), policyDigest: digest(JSON.stringify(policy)), ci: primary.map((item) => item.lookup), reports, verified, baselines };
  writeJson(receiptPath(root, "releases", `${site}.json`), receipt);
  return receipt;
}

export function requireRelease({ root, site, identity, command, expectedCandidate, policy }) {
  requireGate(root, identity, command, policy);
  const candidate = validateCandidate(readJson(receiptPath(root, "candidates", `${site}.json`)), { site, ...identity, ...expectedCandidate });
  const receipt = readJson(receiptPath(root, "releases", `${site}.json`));
  if (receipt.schema !== 1 || receipt.kind !== "release" || receipt.candidateDigest !== digest(JSON.stringify(candidate)) || receipt.policyDigest !== digest(JSON.stringify(policy)) || !Array.isArray(receipt.ci) || receipt.ci.length < 1 || receipt.ci.some((lookup) => !Number.isSafeInteger(lookup.runId) || !Number.isSafeInteger(lookup.artifactId) || !/^sha256:[a-f0-9]{64}$/.test(lookup.artifactDigest) || lookup.repository !== policy.ci.repository || lookup.workflow !== policy.ci.workflow)) throw new Error("release: missing or stale verified CI release receipt");
  validateEvidence(receipt.reports, candidate, policy);
  return { candidate, receipt };
}

export function wranglerJson(args, { cwd, env = process.env }) {
  const output = execFileSync("wrangler", args, { cwd, env, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  const start = output.search(/[\[{]/);
  if (start < 0) throw new Error("release: Cloudflare returned no JSON");
  return JSON.parse(output.slice(start));
}

/** Promote the tested bytes, preserving an available rollback version first. */
export async function promoteCandidate({ root, site, cwd, env, validate, requiredSecrets = [], query = wranglerJson, run = runRecorded }) {
  const { candidate } = validate();
  const options = { cwd, env };
  const version = (id) => {
    const found = query(["versions", "view", id, "--name", candidate.worker, "--json"], options);
    if (found.id !== id) throw new Error("release: Cloudflare cannot verify the recorded Worker version");
    return found;
  };
  console.log(`release: checking candidate and rollback versions for ${candidate.worker}`);
  const uploaded = version(candidate.candidateVersion);
  const bindings = uploaded.resources?.bindings ?? [];
  if (requiredSecrets.some((name) => !bindings.some((binding) => binding.type === "secret_text" && binding.name === name))) throw new Error("release: uploaded version is missing required secret bindings");
  const deployments = () => latestDeployment(query(["deployments", "list", "--name", candidate.worker, "--json"], options));
  const previous = deployments();
  for (const item of previous.versions) version(item.version_id);
  const current = validate().candidate;
  if (digest(JSON.stringify(current)) !== digest(JSON.stringify(candidate))) throw new Error("release: candidate changed during production preflight");
  const attempt = {
    schema: 1, kind: "deployment", startedAt: new Date().toISOString(), site,
    sourceHead: candidate.sourceHead, sourceFingerprint: candidate.sourceFingerprint,
    candidateVersion: candidate.candidateVersion, buildOutput: candidate.buildOutput,
    previous, rollbackCommand: ["wrangler", "versions", "deploy", ...previous.versions.map((item) => `${item.version_id}@${item.percentage}`), "--name", candidate.worker, "--yes"],
  };
  const path = receiptPath(root, "deployments", `${site}-${Date.now()}.json`);
  writeJson(path, attempt);
  const result = await run("wrangler", ["versions", "deploy", `${candidate.candidateVersion}@100%`, "--name", candidate.worker, "--yes"], { ...options, log: `${path}.log` });
  attempt.outcome = commandOutcome(result);
  writeJson(path, attempt);
  if (result.exitCode !== 0 || result.signal !== null || result.error) throw new Error(`release: promotion failed or was interrupted; inspect ${path} before retrying`);
  attempt.observedDeployment = deployments();
  writeJson(path, attempt);
  if (attempt.observedDeployment.versions.length !== 1 || attempt.observedDeployment.versions[0].version_id !== candidate.candidateVersion || attempt.observedDeployment.versions[0].percentage !== 100) throw new Error(`release: production does not report the promoted version; inspect ${path}`);
  console.log(`release: promoted ${candidate.candidateVersion}; rollback and provider verification recorded in ${path}`);
  return attempt;
}
