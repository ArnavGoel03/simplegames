import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

assert(process.argv[2], "Pass the games source checkout path");
const root = resolve(process.argv[2]);
const directory = new URL("./fixtures/player-history/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
const head = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 10_000 }).trim();
const { workspaceFingerprint } = await import(pathToFileURL(resolve(root, "scripts/build-state.mjs")));
const requireMarkupSource = () => {
  assert.equal(head(), manifest.sourceHead, "Regenerate markup from the final games commit first");
  assert.equal(workspaceFingerprint(root, { head: manifest.sourceHead }), manifest.sourceFingerprint, "Markup source changed before canonical cookie capture");
};
requireMarkupSource();
const { hintCookie } = JSON.parse(execFileSync("pnpm", ["--filter", "web", "exec", "tsx", "-e",
  "import { SESSION_HINT_COOKIE } from '@play/identity/session'; console.log(JSON.stringify({ hintCookie: SESSION_HINT_COOKIE }));"],
{ cwd: root, encoding: "utf8", timeout: 20_000 }));
requireMarkupSource();
assert(/^[a-zA-Z0-9_-]+$/.test(hintCookie));
writeFileSync(new URL("session.json", directory), JSON.stringify({
  sourceHead: manifest.sourceHead, sourceFingerprint: manifest.sourceFingerprint, hintCookie,
  provenance: "SESSION_HINT_COOKIE imported from @play/identity/session in the bound games source checkout; no credential values read",
}, null, 2));
console.log(`Recorded canonical hint-cookie name for ${manifest.sourceHead}`);
