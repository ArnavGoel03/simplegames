import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";

const workflow = readFileSync(new URL("../../.github/workflows/visual.yml", import.meta.url), "utf8");
const history = "Verify synthetic player history with candidate styles";

function installationContract(source) {
  assert.match(source, /BROWSER_INSTALL_TIMEOUT_SECONDS: 150/);
  const cache = source.split("      - name: Cache browser binaries\n")[1]?.split("      - ")[0];
  assert(cache, "Missing browser binary cache");
  assert.match(cache, /path: ~\/\.cache\/ms-playwright/);
  assert.match(cache, /key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}-\$\{\{ inputs\.browser \|\| 'chromium' \}\}/);
  assert.doesNotMatch(cache, /restore-keys:/);
  for (const name of ["Install browser dependencies", "Install browser"]) {
    const block = source.split(`      - name: ${name}\n`)[1]?.split("      - ")[0];
    assert(block, `Missing ${name}`);
    assert.doesNotMatch(block, /^        if:/m, "Cache hits must not bypass dependency validation or installation");
    assert.match(block, /timeout-minutes: 3/);
    assert.match(block, /timeout --kill-after=5s "\$\{BROWSER_INSTALL_TIMEOUT_SECONDS\}s" npx playwright install/);
  }
}

test("browser installation caches exact lockfile and engine without skipping validation", () => {
  installationContract(workflow);
  for (const broken of [
    workflow.replace("hashFiles('package-lock.json')", "'shared'"),
    workflow.replace(/(key: playwright-[^\n]+)-\$\{\{ inputs\.browser \|\| 'chromium' \}\}/, "$1"),
    workflow.replace("      - name: Install browser dependencies\n", "      - name: Install browser dependencies\n        if: steps.cache.outputs.cache-hit != 'true'\n"),
  ]) assert.throws(() => installationContract(broken));
});

test("native dependency installation replaces the observed stalled mirror and bounds network work", () => {
  const block = workflow.split("      - name: Install browser dependencies\n")[1].split("      - ")[0];
  assert.match(workflow, /runs-on: ubuntu-24\.04\n    timeout-minutes: 10/);
  assert.match(block, /https:\/\/archive\.ubuntu\.com\/ubuntu.+sudo tee \/etc\/apt\/apt-mirrors\.txt/);
  assert.match(block, /Acquire::http::Timeout "15";/);
  assert.match(block, /Acquire::https::Timeout "15";/);
  assert.match(block, /Acquire::Retries "1";/);
  assert.match(block, /npx playwright install-deps "\$BROWSER_ENGINE"/);
  const shell = block.split("        run: |\n")[1].replace(/^          /gm, "");
  const syntax = spawnSync("bash", ["-n"], { input: shell, encoding: "utf8", timeout: 1000 });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(workflow, /PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: 15000/);
});

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

test("accessibility candidate verification remains enabled and respects diagnostic modes", () => {
  for (const site of ["studio", "board", "words", "cards", "draw", "teenpatti"]) assert.equal(enabled("Verify accessibility", [site]), true);
  assert.equal(enabled("Verify accessibility", []), false);
  for (const flag of ["controls_only", "network_probe_only", "cancelled"]) {
    assert.equal(enabled("Verify accessibility", ["cards"], { [flag]: true }), false);
  }
});

test("actual control geometry checks all candidate sites and excludes diagnostic-only modes", () => {
  for (const site of ["studio", "board", "cards", "words", "draw", "teenpatti"]) assert.equal(enabled("Verify control geometry", [site]), true);
  assert.equal(enabled("Verify control geometry", []), false);
  for (const flag of ["controls_only", "network_probe_only", "cancelled"]) assert.equal(enabled("Verify control geometry", ["draw"], { [flag]: true }), false);
});
