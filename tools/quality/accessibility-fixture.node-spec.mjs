import assert from "node:assert/strict";
import test from "node:test";
import { accessibilitySites, between, digest, verifyFixture } from "../accessibility-fixture.mjs";

const candidate = { sourceHead: "a".repeat(40), sourceFingerprint: "b".repeat(64), buildOutput: "c".repeat(64) };
const bytes = Buffer.from("canonical component bundle");
const manifest = { schema: 1, synthetic: true, ...candidate, sha256: digest(bytes), sources: [{ path: "Modal.tsx", sha256: digest("original") }] };
test("canonical bundle is bound to candidate source, build and original source hashes", () => {
  assert.doesNotThrow(() => verifyFixture(manifest, candidate, bytes));
  for (const field of ["sourceHead", "sourceFingerprint", "buildOutput"]) {
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
