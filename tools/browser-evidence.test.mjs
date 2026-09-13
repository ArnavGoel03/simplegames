import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { networkVerdict, observeFetchSignals, observeResponseStreams, parseCandidates, predecessorWorkerVersion, siteKey } from "./browser-evidence.mjs";

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
  it("binds game and studio worker source tokens without replacing the studio build ID", () => {
    const source = "0352930a" + "a".repeat(32);
    expect(predecessorWorkerVersion("teenpatti-1.3.0-0352930a", source)).toBe("teenpatti-1.3.0-00000000");
    expect(predecessorWorkerVersion("glasstable-studio-0352930a-oCVO6X3lbA-4CHXlrtyzn", source)).toBe("glasstable-studio-00000000-oCVO6X3lbA-4CHXlrtyzn");
    expect(() => predecessorWorkerVersion("studio-other-source", source)).toThrow();
    expect(() => predecessorWorkerVersion("studio-0352930a-0352930a", source)).toThrow();
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
    expect(events[1]).toMatchObject({ kind: "fetch-signal-abort", documentId: "document-1", id: 1 });
  });

  it("distinguishes absent signals and concurrent requests without classifying either as harmless", () => {
    const { window, events } = fixture(() => Promise.resolve());
    const controller = new AbortController();
    window.fetch("/route", { headers });
    window.fetch("/route", { headers, signal: controller.signal });
    controller.abort();
    expect(events.map(event => [event.kind, event.id, event.hasSignal])).toEqual([
      ["prefetch-start", 1, false], ["prefetch-start", 2, true], ["fetch-signal-abort", 2, undefined],
    ]);
  });

  it("distinguishes static HEAD probes without observing private or cross-origin requests", () => {
    const { window, events } = fixture(() => Promise.resolve());
    window.fetch("/_next/static/file.css", { method: "HEAD" });
    window.fetch("/api/account", { method: "POST", headers });
    window.fetch("https://other.test/route", { headers });
    expect(events).toMatchObject([{ kind: "asset-fetch-start", method: "HEAD", hasSignal: false }]);
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

describe("native response cancellation observation", () => {
  function fixture({ readFailure, cancelFailure } = {}) {
    const events = [];
    const calls = [];
    const promise = Promise.resolve();
    const readPromise = readFailure ? Promise.reject(readFailure) : Promise.resolve({ done: true });
    class Reader {
      cancel(...args) { if (cancelFailure) throw cancelFailure; calls.push({ receiver: this, args }); return promise; }
      read() { return readPromise; }
    }
    class Stream {
      reader = new Reader();
      getReader() { return this.reader; }
      cancel(...args) { calls.push({ receiver: this, args }); return promise; }
    }
    class FixtureResponse {
      url = "https://fixture.test/route?_rsc=one";
      status = 200;
      headers = new Headers({ "content-type": "text/x-component" });
      stream = new Stream();
      get body() { return this.stream; }
    }
    runInNewContext(`(${observeResponseStreams.toString()})()`, {
      window: { recordFetchObservation: event => { events.push(event); return Promise.resolve(); } },
      Response: FixtureResponse, ReadableStream: Stream, ReadableStreamDefaultReader: Reader,
      ReadableStreamBYOBReader: class { cancel() {} }, URL, location: new URL("https://fixture.test/"),
    });
    return { events, calls, promise, readPromise, response: new FixtureResponse() };
  }
  it("preserves body/reader identity and the native cancellation promise and arguments", () => {
    const { response, events, calls, promise } = fixture();
    expect(response.body).toBe(response.stream);
    const reader = response.body.getReader();
    expect(reader).toBe(response.stream.reader);
    const reason = { private: "never recorded" };
    expect(reader.cancel(reason)).toBe(promise);
    expect(calls).toEqual([{ receiver: reader, args: [reason] }]);
    expect(events).toMatchObject([{ kind: "response-reader-cancel", status: 200, url: response.url }]);
    expect(JSON.stringify(events)).not.toContain("private");
  });
  it("observes direct body cancellation but never invents intent for an untouched stream", () => {
    const { response, events, promise } = fixture();
    const body = response.body;
    expect(events).toEqual([]);
    expect(body.cancel()).toBe(promise);
    expect(events).toMatchObject([{ kind: "response-stream-cancel" }]);
  });
  it("does not observe private JSON or cross-origin response bodies", () => {
    for (const type of ["private", "cross-origin"]) {
      const { response, events } = fixture();
      if (type === "private") response.headers.set("content-type", "application/json");
      else response.url = "https://other.test/route";
      response.body.getReader().cancel();
      expect(events).toEqual([]);
    }
  });
  it("observes native completion while preserving the original read promise", async () => {
    const { response, events, readPromise } = fixture();
    const reader = response.body.getReader();
    const promise = reader.read();
    expect(promise).toBe(readPromise);
    expect(await promise).toEqual({ done: true });
    expect(events).toMatchObject([{ kind: "response-reader-complete" }]);
    await reader.read();
    expect(events).toHaveLength(1);
  });
  it("records read rejection before later cancellation and does not invent intent for a thrown cancel", async () => {
    const failure = new Error("native failure");
    const broken = fixture({ readFailure: failure });
    const reader = broken.response.body.getReader();
    await expect(reader.read()).rejects.toBe(failure);
    await reader.cancel();
    expect(broken.events.map(event => event.kind)).toEqual(["response-reader-error", "response-reader-cancel"]);
    const thrown = fixture({ cancelFailure: failure });
    expect(() => thrown.response.body.getReader().cancel()).toThrow(failure);
    expect(thrown.events).toEqual([]);
  });
});

describe("exact response network verdict", () => {
  const response = { kind: "response", requestId: 1, status: 200, contentType: "text/x-component", ray: "1234567890abcdef-BOM" };
  const failure = { requestId: 1, requestKey: "key", error: "net::ERR_ABORTED", method: "GET", rsc: true, prefetch: true, startedAt: 10, at: 30 };
  const intent = { kind: "response-reader-complete", requestKey: "key", ray: response.ray, status: 200, at: 20 };
  const probe = trace => ({ trace, failed: [failure], errors: [], counts: { failed: 1 } });
  it("keeps 200 headers, unknown aborts and failed streams as failures", () => {
    expect(networkVerdict(probe([response])).passed).toBe(false);
    expect(networkVerdict(probe([])).passed).toBe(false);
    expect(networkVerdict(probe([response, { ...intent, kind: "response-reader-error" }])).passed).toBe(false);
  });
  it("accepts only a unique same-request native completion or explicit cancellation", () => {
    for (const kind of ["response-reader-complete", "response-reader-cancel", "response-stream-cancel"]) {
      expect(networkVerdict(probe([response, { ...intent, kind }]))).toMatchObject({ passed: true, failures: [], classified: [{ requestId: 1, reason: kind }] });
    }
  });
  it("rejects wrong identities, late observations, missing rays and non-abort failures", () => {
    for (const change of [{ requestKey: "other" }, { ray: "other" }, { at: 31 }, { at: 9 }, { status: 404 }]) {
      expect(networkVerdict(probe([response, { ...intent, ...change }])).passed).toBe(false);
    }
    expect(networkVerdict(probe([{ ...response, ray: null }, intent])).passed).toBe(false);
    expect(networkVerdict(probe([response, { ...response, requestId: 2 }, intent])).passed).toBe(false);
    const broken = probe([response, intent]);
    broken.failed = [{ ...failure, error: "net::ERR_CONNECTION_RESET" }];
    expect(networkVerdict(broken).passed).toBe(false);
    broken.failed = [{ ...failure, rsc: false }];
    expect(networkVerdict(broken).passed).toBe(false);
  });
  it("rejects a read or cancellation error even when the same response later has intent", () => {
    for (const kind of ["response-reader-error", "response-cancel-error"]) {
      expect(networkVerdict(probe([response, { ...intent, kind, at: 19 }, { ...intent, kind: "response-reader-cancel" }])).passed).toBe(false);
    }
  });
});
