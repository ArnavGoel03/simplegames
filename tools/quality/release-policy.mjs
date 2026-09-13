// Pure release policy, shared unchanged with the public studio repository.
export const BROWSER_ENGINES = ["chromium", "webkit"];
export const SHA256 = /^[a-f0-9]{64}$/;
export const SOURCE_HEAD = /^[a-f0-9]{40}$/;
export const VERSION_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

function requireValue(condition, message) {
  if (!condition) throw new Error(`release: ${message}`);
}

function nonemptyUnique(values, label) {
  requireValue(Array.isArray(values) && values.length > 0 && values.length <= 100, `${label} must be a nonempty bounded array`);
  requireValue(values.every((value) => typeof value === "string" && value.length > 0) && new Set(values).size === values.length, `${label} contains invalid or duplicate IDs`);
}

export function measuredValue(samples, statistic, minimum = 1) {
  requireValue(Number.isInteger(minimum) && minimum > 0 && minimum <= 1000, "invalid sample requirement");
  requireValue(Array.isArray(samples) && samples.length >= minimum && samples.length <= 1000 && samples.every((n) => Number.isFinite(n) && n >= 0), "invalid or insufficient measured samples");
  requireValue(statistic === "max" || statistic === "median", "unknown measurement statistic");
  const sorted = [...samples].sort((a, b) => a - b);
  if (statistic === "max") return sorted.at(-1);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function sitePolicy(policy, site) {
  requireValue(policy?.schema === 1, "missing or unsupported release policy");
  const config = policy.sites?.[site];
  requireValue(config && typeof config === "object", `no measured release policy for ${site}`);
  nonemptyUnique(config.checks, "required checks");
  nonemptyUnique(config.metrics?.map((metric) => metric.id), "required metrics");
  for (const metric of config.metrics) {
    requireValue(["ms", "bytes"].includes(metric.unit) && ["max", "median"].includes(metric.statistic), `invalid metric policy ${metric.id}`);
    requireValue(Number.isFinite(metric.limit) && metric.limit >= 0, `invalid measured limit ${metric.id}`);
    const baseline = metric.baseline;
    requireValue(baseline && SOURCE_HEAD.test(baseline.sourceHead) && Number.isSafeInteger(baseline.runId) && baseline.runId > 0 && Number.isSafeInteger(baseline.artifactId) && baseline.artifactId > 0 && Number.isFinite(baseline.value) && baseline.value >= 0, `missing measured CI baseline for ${metric.id}`);
  }
  return config;
}

export function validateCandidate(candidate, expected) {
  requireValue(candidate?.schema === 1 && candidate.kind === "candidate", "missing candidate upload receipt");
  requireValue(SOURCE_HEAD.test(candidate.sourceHead) && SHA256.test(candidate.sourceFingerprint) && SHA256.test(candidate.buildSource) && SHA256.test(candidate.buildOutput) && VERSION_ID.test(candidate.candidateVersion), "invalid candidate identity");
  for (const [key, value] of Object.entries(expected)) requireValue(candidate[key] === value, `candidate ${key} is stale or belongs to another app`);
  const origin = new URL(candidate.origin);
  requireValue(origin.protocol === "https:" && origin.origin === candidate.origin && !origin.username && !origin.password, "invalid candidate preview origin");
  requireValue(candidate.upload?.exitCode === 0 && candidate.upload.signal === null && SHA256.test(candidate.upload.logDigest), "candidate has no successful upload outcome");
  return candidate;
}

/** Every supplied result must pass; missing, duplicate and skipped checks fail. */
export function validateEvidence(reports, candidate, policy) {
  const config = sitePolicy(policy, candidate.site);
  requireValue(Array.isArray(reports) && reports.length > 0 && reports.length <= 100, "missing browser reports");
  const matching = reports.filter((report) => report?.site === candidate.site);
  requireValue(matching.length > 0, "CI artifact contains no report for this app");
  const browsers = [];
  for (const report of matching) {
    for (const key of ["candidateVersion", "sourceHead", "sourceFingerprint", "buildOutput", "origin"]) requireValue(report[key] === candidate[key], `browser report ${key} does not match uploaded candidate`);
    requireValue(Array.isArray(report.browsers) && report.browsers.length > 0, "missing browser results");
    browsers.push(...report.browsers);
  }
  nonemptyUnique(browsers.map((browser) => browser.engine), "browser engines");
  requireValue(browsers.length === BROWSER_ENGINES.length && BROWSER_ENGINES.every((engine) => browsers.some((browser) => browser.engine === engine)), "both Chromium and WebKit must pass");
  return browsers.map((browser) => {
    requireValue(browser.observedSourceHead === candidate.sourceHead, `${browser.engine} did not observe the candidate's full source revision in HTML`);
    nonemptyUnique(browser.checks?.map((check) => check.id), `${browser.engine} checks`);
    requireValue(browser.checks.every((check) => check.status === "passed"), `${browser.engine} has a failed or skipped check`);
    requireValue(config.checks.every((id) => browser.checks.some((check) => check.id === id)), `${browser.engine} is missing required checks`);
    nonemptyUnique(browser.measurements?.map((metric) => metric.id), `${browser.engine} measurements`);
    const measurements = config.metrics.map((budget) => {
      const metric = browser.measurements.find((item) => item.id === budget.id);
      requireValue(metric?.unit === budget.unit, `${browser.engine} is missing ${budget.id} in ${budget.unit}`);
      const actual = measuredValue(metric.samples, budget.statistic, budget.minSamples ?? 1);
      requireValue(actual <= budget.limit, `${browser.engine} ${budget.id}: ${actual} ${budget.unit} exceeds ${budget.limit}`);
      return { id: budget.id, unit: budget.unit, statistic: budget.statistic, actual, limit: budget.limit };
    });
    return { engine: browser.engine, checks: browser.checks.map((check) => check.id), measurements };
  });
}

/** The public CI harness is trusted only after provider metadata is checked. */
export function validateCILookup(run, artifact, ci, runId, artifactId) {
  requireValue(ci && /^[\w.-]+\/[\w.-]+$/.test(ci.repository) && /^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(ci.workflow), "missing trusted CI repository/workflow policy");
  requireValue(run?.id === runId && run.status === "completed" && run.conclusion === "success" && run.event === "workflow_dispatch", "CI run did not complete a successful manual verification");
  requireValue(run.repository?.full_name === ci.repository && run.head_repository?.full_name === ci.repository && run.path === ci.workflow && SOURCE_HEAD.test(run.head_sha), "CI run does not belong to the trusted workflow/source repository");
  requireValue(artifact?.id === artifactId && artifact.workflow_run?.id === runId && artifact.expired === false && typeof artifact.digest === "string" && /^sha256:[a-f0-9]{64}$/.test(artifact.digest), "CI artifact is expired, unverified or from another run");
  requireValue(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= 64 * 1024 * 1024, "CI artifact exceeds the bounded download size");
  return { repository: ci.repository, workflow: ci.workflow, runId, artifactId, workflowSourceHead: run.head_sha, runUrl: run.html_url, artifactDigest: artifact.digest, artifactName: artifact.name };
}

export function parseUploadedVersion(output) {
  const ids = [...output.matchAll(/Worker Version ID:\s*([a-f0-9-]+)/g)].map((match) => match[1]);
  requireValue(ids.length === 1 && VERSION_ID.test(ids[0]), "upload did not identify exactly one immutable Worker version");
  return ids[0];
}

export function latestDeployment(deployments) {
  requireValue(Array.isArray(deployments) && deployments.length > 0 && deployments.every((item) => Number.isFinite(Date.parse(item.created_on))), "cannot identify the current deployment for rollback");
  const latest = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  requireValue(typeof latest.id === "string" && Array.isArray(latest.versions) && latest.versions.length > 0 && latest.versions.every((version) => VERSION_ID.test(version.version_id) && Number.isFinite(version.percentage) && version.percentage > 0 && version.percentage <= 100) && latest.versions.reduce((sum, version) => sum + version.percentage, 0) === 100, "current deployment has an invalid version/traffic record");
  nonemptyUnique(latest.versions.map((version) => version.version_id), "rollback versions");
  return { id: latest.id, createdAt: latest.created_on, versions: latest.versions.map(({ version_id, percentage }) => ({ version_id, percentage })) };
}
