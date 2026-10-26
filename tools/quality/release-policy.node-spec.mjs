import { test } from "node:test";
import assert from "node:assert/strict";
import { latestDeployment, measuredValue, parseUploadedVersion, validateCandidate } from "./release-policy.mjs";

const head = "a".repeat(40);
const sha = "b".repeat(64);
const uuid = "12345678-1234-1234-1234-123456789abc";
const candidate = { schema: 1, kind: "candidate", appVersion: "1.0.1", site: "board", worker: "board", sourceHead: head, sourceFingerprint: sha, buildSource: sha, buildOutput: sha, candidateVersion: uuid, origin: "https://candidate.example.test", upload: { exitCode: 0, signal: null, logDigest: sha } };

test("computes measured statistics and validates a matching candidate", () => {
  assert.equal(measuredValue([6, 2, 4, 8], "median"), 5);
  assert.equal(measuredValue([6, 2, 4], "max"), 6);
  assert.doesNotThrow(() => validateCandidate(candidate, { site: "board", sourceHead: head }));
  assert.throws(() => validateCandidate({ ...candidate, upload: { exitCode: 1 } }, {}), /upload/);
  for (const key of ["sourceHead", "sourceFingerprint", "buildOutput", "origin", "worker"]) assert.throws(() => validateCandidate(candidate, { [key]: "other" }), /stale/);
});

test("upload version parser rejects missing, malformed and ambiguous output", () => {
  assert.equal(parseUploadedVersion(`Uploaded worker\nWorker Version ID: ${uuid}\n`), uuid);
  for (const output of ["Uploaded worker", "Worker Version ID: invalid", `Worker Version ID: ${uuid}\nWorker Version ID: ${uuid}`]) assert.throws(() => parseUploadedVersion(output));
});

test("rollback selection uses provider timestamps, preserving the complete traffic split", () => {
  const old = { id: "old", created_on: "2026-09-12T00:00:00Z", versions: [{ version_id: uuid, percentage: 100 }] };
  const current = { id: "current", created_on: "2026-09-13T00:00:00Z", versions: [{ version_id: uuid, percentage: 25 }, { version_id: "22345678-1234-1234-1234-123456789abc", percentage: 75 }] };
  assert.equal(latestDeployment([current, old]).id, "current");
  assert.deepEqual(latestDeployment([old, current]).versions, current.versions);
  assert.throws(() => latestDeployment([]));
  assert.throws(() => latestDeployment([{ ...current, versions: [{ version_id: uuid, percentage: 40 }] }]));
});
