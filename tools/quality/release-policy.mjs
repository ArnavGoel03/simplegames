// Pure release policy, shared unchanged with the public studio repository.
export const SHA256 = /^[a-f0-9]{64}$/;
export const SOURCE_HEAD = /^[a-f0-9]{40}$/;
export const VERSION_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

// Stable application releases use three numeric components, without coercion.
export function versionParts(value) {
  requireValue(typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value), "missing or malformed application version");
  const parts = value.split(".").map(Number);
  requireValue(parts.every(Number.isSafeInteger), "application version exceeds safe integer range");
  return parts;
}

export function requireVersionAdvance(candidate, current) {
  const next = versionParts(candidate), previous = versionParts(current);
  const difference = next.findIndex((part, i) => part !== previous[i]);
  requireValue(difference >= 0 && next[difference] > previous[difference], "application version must advance beyond every live version");
}

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

export function validateCandidate(candidate, expected) {
  requireValue(candidate?.schema === 1 && candidate.kind === "candidate", "missing candidate upload receipt");
  if (candidate.site !== "realtime") versionParts(candidate.appVersion);
  requireValue(SOURCE_HEAD.test(candidate.sourceHead) && SHA256.test(candidate.sourceFingerprint) && SHA256.test(candidate.buildSource) && SHA256.test(candidate.buildOutput) && VERSION_ID.test(candidate.candidateVersion), "invalid candidate identity");
  for (const [key, value] of Object.entries(expected)) requireValue(candidate[key] === value, `candidate ${key} is stale or belongs to another app`);
  const origin = new URL(candidate.origin);
  requireValue(origin.protocol === "https:" && origin.origin === candidate.origin && !origin.username && !origin.password, "invalid candidate preview origin");
  requireValue(candidate.upload?.exitCode === 0 && candidate.upload.signal === null && SHA256.test(candidate.upload.logDigest), "candidate has no successful upload outcome");
  return candidate;
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
