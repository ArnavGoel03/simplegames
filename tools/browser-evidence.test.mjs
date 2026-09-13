import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { observeFetchSignals, parseCandidates, siteKey } from "./browser-evidence.mjs";

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

describe("original prefetch signal observation", () => {
  function fixture(original) {
    const events = [];
    const window = { fetch: original, recordFetchObservation: event => { events.push(event); return Promise.resolve(); } };
    runInNewContext(`(${observeFetchSignals.toString()})()`, {
      window, Request, Headers, URL, location: new URL("https://fixture.test/"), crypto: { randomUUID: () => "document-1" },
    });
    return { window, events };
  }
  const headers = { rsc: "1", "next-router-prefetch": "1" };

  it("returns the exact original promise and forwards unchanged arguments and receiver", () => {
    const promise = Promise.resolve(new Response("ok"));
    let called;
    const { window, events } = fixture(function (...args) { called = { receiver: this, args }; return promise; });
    const controller = new AbortController();
    const init = { headers, signal: controller.signal };
    expect(window.fetch("https://fixture.test/route?_rsc=fixture", init)).toBe(promise);
    expect(called.receiver).toBe(window);
    expect(called.args[1]).toBe(init);
    expect(events).toMatchObject([{ kind: "prefetch-start", id: 1, hasSignal: true, aborted: false }]);
    controller.abort();
    expect(events[1]).toMatchObject({ kind: "prefetch-signal-abort", documentId: "document-1", id: 1 });
  });

  it("distinguishes absent signals and concurrent requests without classifying either as harmless", () => {
    const { window, events } = fixture(() => Promise.resolve());
    const controller = new AbortController();
    window.fetch("/route", { headers });
    window.fetch("/route", { headers, signal: controller.signal });
    controller.abort();
    expect(events.map(event => [event.kind, event.id, event.hasSignal])).toEqual([
      ["prefetch-start", 1, false], ["prefetch-start", 2, true], ["prefetch-signal-abort", 2, undefined],
    ]);
  });

  it("does not observe ordinary assets, private requests or cross-origin requests", () => {
    const { window, events } = fixture(() => Promise.resolve());
    window.fetch("/_next/static/file.css");
    window.fetch("/api/account", { method: "POST", headers });
    window.fetch("https://other.test/route", { headers });
    expect(events).toEqual([]);
  });

  it("caps observations and preserves original synchronous failures", () => {
    const failure = new Error("original");
    let calls = 0;
    const { window, events } = fixture(() => { calls++; if (calls === 1002) throw failure; return Promise.resolve(); });
    for (let i = 0; i < 1001; i++) window.fetch("/route", { headers });
    expect(events).toHaveLength(1000);
    expect(() => window.fetch("/route", { headers })).toThrow(failure);
    expect(calls).toBe(1002);
  });
});
