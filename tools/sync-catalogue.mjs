// Update the public release snapshot, or detect drift without changing it.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const path = fileURLToPath(new URL("../src/lib/game-catalogue.json", import.meta.url));
const previous = JSON.parse(readFileSync(path, "utf8"));
const source = previous.sites.find((site) => site.id === "chaupal").url;
const response = await fetch(new URL("/api/studio-catalogue", source), { signal: AbortSignal.timeout(15000) });
assert(response.ok, `Catalogue returned HTTP ${response.status}`);
const current = await response.json();
const policyPath = fileURLToPath(new URL("./html-policy.mjs", import.meta.url));
const policyResponse = await fetch(new URL("/runtime-policy.mjs", source), { signal: AbortSignal.timeout(15000) });
assert(policyResponse.ok, `Runtime policy returned HTTP ${policyResponse.status}`);
const policy = await policyResponse.text();
assert(policy.length < 20000 && policy.includes("export function protectHtml") && policy.includes("export function writeHtmlPolicyWorker"), "Unexpected runtime policy source");
assert.equal(current.version, 1);
assert(Array.isArray(current.sites) && current.sites.length > 0);
const ids = new Set();
for (const site of current.sites) {
  assert(typeof site.id === "string" && !ids.has(site.id));
  ids.add(site.id);
  assert(typeof site.name === "string" && site.name.trim());
  const url = new URL(site.url);
  assert.equal(url.protocol, "https:");
  assert.equal(url.username + url.password, "");
  if (site.games !== undefined) {
    assert(Array.isArray(site.games) && site.games.length > 0);
    for (const game of site.games) assert(typeof game.id === "string" && typeof game.name === "string" && game.name.trim());
  }
}
if (process.argv.includes("--check")) {
  assert.deepEqual(previous, current, "Studio catalogue differs from the released games; run npm run sync:catalogue");
  assert.equal(readFileSync(policyPath, "utf8"), policy, "Runtime policy differs from the game release");
  console.log("Studio catalogue and runtime policy match the game release");
} else {
  writeFileSync(path, JSON.stringify(current, null, 2) + "\n");
  writeFileSync(policyPath, policy);
  console.log("Studio catalogue and runtime policy updated; review both before release");
}
