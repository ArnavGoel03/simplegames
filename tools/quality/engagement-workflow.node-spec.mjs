import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/visual.yml", import.meta.url), "utf8");
function assertDiagnosticIsolation(source) {
  const steps = source.split(/^      - /m).slice(1);
  const certification = steps.filter(step => /name: (candidate-evidence|performance-baseline)/.test(step));
  assert.equal(certification.length, 2);
  for (const step of certification) assert.match(step, /if:.*!inputs\.engagement_only/);
  const suites = steps.filter(step => /run:.*(?:verify-(?!engagement)[\w-]+\.mjs|probe-[\w-]+\.mjs|npm run build)/.test(step));
  assert(suites.length >= 8);
  for (const step of suites) assert.match(step, /if:.*!inputs\.engagement_only/);
  assert.match(source, /name:.*engagement-diagnostic-only/);
  assert.match(source, /run: test ! -e \.audit\/visual\/release-evidence\.json/);
}

test("engagement diagnostics cannot run full suites or publish certification artifacts", () => {
  assertDiagnosticIsolation(workflow);
  const exposed = workflow.replace(/(if: \$\{\{ )!inputs\.engagement_only && (inputs\.release_candidates_json && !inputs\.controls_only && !inputs\.network_probe_only && success\(\))/, "$1$2");
  assert.notEqual(exposed, workflow, "Positive control must remove the candidate publication guard");
  assert.throws(() => assertDiagnosticIsolation(exposed));
});
