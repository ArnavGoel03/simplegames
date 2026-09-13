import { describe, expect, it } from "vitest";
import { parseCandidates, siteKey } from "./browser-evidence.mjs";

const candidate = {
  site: "board", candidateVersion: "10000000-0000-4000-8000-000000000000",
  sourceHead: "a".repeat(40), sourceFingerprint: "b".repeat(64), buildOutput: "c".repeat(64),
  origin: "https://10000000-chaupal-games.goelhome.workers.dev",
};

describe("browser candidate binding", () => {
  it("keeps baseline runs uncertified and accepts an exact immutable candidate", () => {
    expect(parseCandidates(undefined)).toEqual([]);
    expect(parseCandidates(JSON.stringify([candidate]))).toEqual([candidate]);
    expect(siteKey("chaupal")).toBe("board");
    expect(siteKey("lattice")).toBe("words");
  });
  it("rejects unbound, duplicate, mutable and malformed candidates", () => {
    for (const change of [{ sourceHead: "a".repeat(7) }, { buildOutput: null }, { candidateVersion: "-".repeat(36) },
      { origin: "https://circuit.glasstablegames.com" }, { origin: candidate.origin + "/other" }, { site: "unknown" }]) {
      expect(() => parseCandidates(JSON.stringify([{ ...candidate, ...change }]))).toThrow();
    }
    expect(() => parseCandidates(JSON.stringify([candidate, candidate]))).toThrow();
  });
});
