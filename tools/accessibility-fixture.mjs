import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const accessibilitySites = { words: "lattice", cards: "judgement", draw: "draw" };
export const digest = bytes => createHash("sha256").update(bytes).digest("hex");

// Keep the original JSX and functions. Only the surrounding fixture state differs.
export function between(source, start, end) {
  assert.equal(source.split(start).length, 2, `Ambiguous component start: ${start}`);
  const tail = source.split(start)[1];
  assert(tail.includes(end), `Missing component end: ${end}`);
  return tail.slice(0, tail.indexOf(end));
}

export function verifyFixture(manifest, candidate, bytes) {
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.synthetic, true);
  assert.equal(manifest.sourceHead, candidate.sourceHead, "Accessibility fixture HEAD differs from candidate");
  assert.equal(manifest.sourceFingerprint, candidate.sourceFingerprint, "Accessibility fixture source differs from candidate");
  assert.equal(manifest.buildSource, candidate.buildSource, "Accessibility fixture app source differs from candidate");
  assert.equal(manifest.buildOutput, candidate.buildOutput, "Accessibility fixture build differs from candidate");
  assert.equal(digest(bytes), manifest.sha256, "Accessibility fixture bundle changed");
  assert(manifest.sources.length > 0 && manifest.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256)));
}
