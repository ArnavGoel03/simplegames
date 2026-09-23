import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(new URL("../../.github/workflows/visual.yml", import.meta.url), "utf8");
const history = "Verify synthetic player history with candidate styles";

function enabled(step, sites, flags = {}) {
  const block = workflow.split(`      - name: ${step}\n`)[1];
  assert(block, `Missing workflow step: ${step}`);
  const expression = /^        if: \$\{\{ (.+) \}\}$/m.exec(block.split("      - ")[0])?.[1];
  assert(expression, `Missing workflow condition: ${step}`);
  // These workflow conditions use GitHub's array projection and contains.
  // Evaluate the real expression so changing the guard changes this check.
  const javascript = expression.replace("fromJSON(inputs.release_candidates_json || '[]').*.site",
    "JSON.parse(inputs.release_candidates_json || '[]').map(candidate => candidate.site)");
  return Boolean(runInNewContext(javascript, {
    inputs: { release_candidates_json: sites.length ? JSON.stringify(sites.map(site => ({ site }))) : "", ...flags },
    contains: (values, item) => values.includes(item), cancelled: () => flags.cancelled === true,
  }, { timeout: 100 }));
}

test("player history requires a board candidate and respects diagnostic modes", () => {
  assert.equal(enabled(history, ["teenpatti"]), false);
  assert.equal(enabled(history, ["studio"]), false);
  assert.equal(enabled(history, []), false);
  assert.equal(enabled(history, ["board"]), true);
  assert.equal(enabled(history, ["teenpatti", "board"]), true);
  for (const flag of ["controls_only", "network_probe_only", "cancelled"]) {
    assert.equal(enabled(history, ["board"], { [flag]: true }), false);
  }
});

test("a Casino-only release retains every existing Casino browser check", () => {
  for (const step of ["Verify usable game controls", "Capture responsive pages",
    "Verify startup recovery under failed and stalled resources", "Verify game entry",
    "Verify gameplay across resize", "Verify service worker lifecycle",
    "Calibrate browser network diagnostics", "Inspect Prize Wheel rendering"]) {
    assert.equal(enabled(step, ["teenpatti"]), true, step);
  }
});
