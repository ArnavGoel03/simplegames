#!/usr/bin/env node
import { readJson, receiptPath, recordRelease, requireGate } from "./quality/quality-runtime.mjs";
import { validateCandidate } from "./quality/release-policy.mjs";
import { root, gateCommand, identity, policy, workerName, previewOrigin, buildSource } from "./release-context.mjs";
try {
  const ids = process.argv.slice(2);
  if (!ids.length || ids.some((id) => !/^\d+:\d+$/.test(id))) throw new Error("Usage: node tools/release-receipt.mjs <run-id>:<artifact-id> [<run-id>:<artifact-id> ...]");
  const config = policy();
  requireGate(root, identity(), gateCommand, config);
  const saved = readJson(receiptPath(root, "candidates", "studio.json"));
  const candidate = validateCandidate(saved, { site: "studio", worker: workerName(), ...identity(), buildSource: buildSource(), origin: previewOrigin(saved.candidateVersion) });
  recordRelease({ root, site: "studio", candidate, policy: config, references: ids.map((id) => { const [runId, artifactId] = id.split(":").map(Number); return { runId, artifactId }; }) });
  console.log(`release: studio browser evidence certified for ${candidate.candidateVersion}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
