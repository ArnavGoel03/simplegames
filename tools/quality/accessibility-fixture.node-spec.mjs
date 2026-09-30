import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { accessibilitySites, between, digest, verifyFixture } from "../accessibility-fixture.mjs";

const candidate = { sourceHead: "a".repeat(40), sourceFingerprint: "b".repeat(64), buildOutput: "c".repeat(64), buildSource: "e".repeat(64) };
const bytes = Buffer.from("canonical component bundle");
const manifest = { schema: 1, synthetic: true, ...candidate, sha256: digest(bytes), sources: [{ path: "Modal.tsx", sha256: digest("original") }] };
test("canonical bundle is bound to candidate source, build and original source hashes", () => {
  assert.doesNotThrow(() => verifyFixture(manifest, candidate, bytes));
  for (const field of ["sourceHead", "sourceFingerprint", "buildOutput", "buildSource"]) {
    assert.throws(() => verifyFixture({ ...manifest, [field]: "d".repeat(manifest[field].length) }, candidate, bytes), /differs/);
  }
  assert.throws(() => verifyFixture(manifest, candidate, Buffer.from("tampered")), /bundle changed/);
  assert.throws(() => verifyFixture({ ...manifest, sources: [] }, candidate, bytes));
});
test("source extraction preserves bytes and rejects moved or duplicate boundaries", () => {
  assert.equal(between("prefix START\n<Modal>actual</Modal>\nEND tail", "START", "END"), "\n<Modal>actual</Modal>\n");
  assert.throws(() => between("START START END", "START", "END"), /Ambiguous/);
  assert.throws(() => between("START missing", "START", "END"), /Missing/);
});
test("only games with migrated surfaces require generated accessibility fixtures", () => {
  assert.deepEqual(Object.keys(accessibilitySites), ["words", "cards", "draw"]);
});

// Evaluate the real bundle until React requests its root. The sentinel keeps
// this source bootstrap check independent of a DOM or an installed browser.
function bootstrap(bytes) {
  const reachedRoot = new Error("Reached canonical React root");
  const document = { getElementById() { throw reachedRoot; } };
  const context = { console, window: {}, navigator: {}, document, setTimeout, clearTimeout, TextEncoder, URL, URLSearchParams, AbortController };
  assert.throws(() => runInNewContext(bytes, context, { timeout: 1000 }), error => error === reachedRoot);
}
test("canonical browser bundle initializes without an injected Node process", () => {
  const bytes = readFileSync(new URL("../fixtures/accessibility/bundle.js", import.meta.url), "utf8");
  bootstrap(bytes);
  assert.throws(() => bootstrap("process.env.NEXT_PUBLIC_SITE_URL;" + bytes), /process is not defined/);
});
