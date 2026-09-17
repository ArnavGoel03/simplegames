import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const output = new URL("../.audit/visual/", import.meta.url);
export const engine = process.env.BROWSER_ENGINE || "chromium";
assert(["chromium", "webkit"].includes(engine), "Unknown browser engine");
export const siteKey = id => ({ chaupal: "board", taash: "cards", lattice: "words" })[id] ?? id;

export function parseCandidates(value) {
  if (!value) return [];
  const candidates = JSON.parse(value);
  assert(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 6, "Invalid candidate list");
  const seen = new Set();
  for (const candidate of candidates) {
    assert(["studio", "board", "cards", "words", "draw", "teenpatti"].includes(candidate.site), "Invalid candidate site");
    assert(!seen.has(candidate.site), "Duplicate candidate site");
    seen.add(candidate.site);
    assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(candidate.candidateVersion), "Invalid candidate version");
    for (const field of ["sourceHead", "sourceFingerprint", "buildOutput"]) {
      assert(new RegExp(`^[a-f0-9]{${field === "sourceHead" ? 40 : 64}}$`, "i").test(candidate[field]), `Invalid ${field}`);
    }
    const url = new URL(candidate.origin);
    assert(url.protocol === "https:" && url.origin === candidate.origin && !url.username && !url.password
      && url.hostname.endsWith(".goelhome.workers.dev"), "Candidate must use its immutable preview origin");
  }
  return candidates;
}
export const candidates = parseCandidates(process.env.RELEASE_CANDIDATES_JSON);

export function predecessorWorkerVersion(version, sourceHead) {
  const source = sourceHead.slice(0, 8);
  const parts = version.split("-");
  assert.equal(parts.filter(part => part === source).length, 1, "Candidate worker version differs from rendered source");
  // Game versions end with the source token; studio appends its Next build ID.
  return parts.map(part => part === source ? "00000000" : part).join("-");
}

const observations = new Map();
export async function observeSource(page, site) {
  const key = siteKey(site);
  const url = new URL(page.url());
  if (process.env.BASELINE_ONLY === "true" && candidates.length === 0 && key === "board" && url.pathname === "/") {
    const saved = observations.get(key);
    if (saved?.origin === url.origin && saved.kind === "baseline-reading-page") return saved.sourceHead;
    // The live legacy Circuit homepage omitted BuildStamp. This baseline-only
    // provenance is explicit; candidate homepages must expose their own stamp.
    const probe = await page.context().newPage();
    const errors = [];
    probe.on("pageerror", error => errors.push(error.message));
    try {
      const response = await probe.goto(new URL("/fair-play", url.origin).href, { waitUntil: "domcontentloaded", timeout: 15_000 });
      assert(response?.ok(), "Baseline provenance route failed");
      const sourceHead = await observeSource(probe, site);
      assert.deepEqual(errors, [], "Baseline provenance route raised browser errors");
      observations.set(key, { kind: "baseline-reading-page", origin: url.origin, path: "/fair-play", sourceHead });
      return sourceHead;
    } finally { await probe.close(); }
  }
  // Some game homepages render the footer after client hydration.
  await page.waitForFunction(() => [...document.querySelectorAll('.build-stamp[title], .play-num[title]')]
    .some(element => /^[a-f0-9]{40}$/i.test(element.getAttribute("title") ?? "") && element.getBoundingClientRect().width > 0),
  undefined, { timeout: 15_000 });
  const commits = await page.locator('.build-stamp[title], .play-num[title]').evaluateAll(elements =>
    [...new Set(elements.map(element => element.getAttribute("title")).filter(value => /^[a-f0-9]{40}$/i.test(value ?? "")))]);
  assert.equal(commits.length, 1, "Rendered page must expose one full source commit");
  const candidate = candidates.find(item => item.site === siteKey(site));
  if (candidate) assert.equal(commits[0], candidate.sourceHead, "Rendered source differs from the certified candidate");
  observations.set(key, { kind: "requested-page", origin: url.origin, path: url.pathname, sourceHead: commits[0] });
  return commits[0];
}

export async function recordEvidence(site, observedSourceHead, checks = [], measurements = [], origin) {
  const bound = candidates.find(item => item.site === siteKey(site));
  if (!bound && process.env.BASELINE_ONLY !== "true") return;
  // Partial baseline records omit the candidate tuple and cannot certify deploys.
  const candidate = bound ?? { site: siteKey(site), sourceHead: observedSourceHead, origin, sourceObservation: observations.get(siteKey(site)) };
  assert.equal(observedSourceHead, candidate.sourceHead, "Unobserved candidate source");
  await mkdir(output, { recursive: true });
  const file = new URL("release-evidence.json", output);
  let evidence = { schema: 1, reports: [] };
  try { evidence = JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  assert.equal(evidence.schema, 1);
  let report = evidence.reports.find(item => item.site === candidate.site);
  if (!report) { report = { ...candidate, browsers: [] }; evidence.reports.push(report); }
  for (const field of ["candidateVersion", "sourceHead", "sourceFingerprint", "buildOutput", "origin"]) {
    assert.equal(report[field], candidate[field], "Refusing to mix candidate receipts");
  }
  let browser = report.browsers.find(item => item.engine === engine);
  if (!browser) { browser = { engine, observedSourceHead, checks: [], measurements: [] }; report.browsers.push(browser); }
  assert.equal(browser.observedSourceHead, observedSourceHead);
  for (const check of checks) {
    assert(["passed", "failed", "skipped"].includes(check.status));
    const previous = browser.checks.find(item => item.id === check.id);
    // A later suite cannot erase earlier failure evidence.
    if (previous) { if (previous.status === "passed") previous.status = check.status; }
    else browser.checks.push(check);
  }
  for (const measurement of measurements) {
    assert(measurement.samples.length >= 3 && measurement.samples.every(value => Number.isFinite(value) && value >= 0));
    assert(!browser.measurements.some(item => item.id === measurement.id), "Duplicate measurement");
    browser.measurements.push(measurement);
  }
  await writeFile(file, JSON.stringify(evidence, null, 2));
}

// Observation only: no replacement signal, response reader or promise handler.
// In Next 16.3 viewport cancellation removes queued work, not an active fetch;
// an ERR_ABORTED alone therefore never proves an intentional cancellation.
export function observeFetchSignals() {
  const original = window.fetch;
  const documentId = crypto.randomUUID();
  let sequence = 0;
  const emit = event => { void window.recordFetchObservation({ documentId, at: Date.now(), ...event }).catch(() => {}); };
  window.fetch = function (...args) {
    try {
      const [input, init] = args;
      const request = input instanceof Request ? input : null;
      const url = new URL(request ? request.url : input, location.href);
      const headers = new Headers(init?.headers ?? request?.headers);
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      const prefetch = method === "GET" && headers.get("rsc") === "1" && headers.get("next-router-prefetch") === "1";
      const staticAsset = ["GET", "HEAD"].includes(method) && url.pathname.startsWith("/_next/static/");
      if (sequence < 1000 && url.origin === location.origin && (prefetch || staticAsset)) {
        const id = ++sequence;
        const signal = init?.signal ?? request?.signal;
        emit({ kind: prefetch ? "prefetch-start" : "asset-fetch-start", id, url: url.href, method, hasSignal: Boolean(signal), aborted: signal?.aborted === true });
        signal?.addEventListener("abort", () => emit({ kind: "fetch-signal-abort", id, url: url.href, method }), { once: true });
      }
    } catch { /* Instrumentation must not change fetch behavior. */ }
    return Reflect.apply(original, this, args);
  };
}

// Observe native stream cancellation without consuming, cloning or replacing
// the response, stream, reader or returned promise.
export function observeResponseStreams() {
  const streams = new WeakMap();
  const readers = new WeakMap();
  const completed = new WeakSet();
  let sequence = 0;
  const emit = event => {
    if (sequence++ < 1000) void window.recordFetchObservation({ at: Date.now(), ...event }).catch(() => {});
  };
  const descriptor = Object.getOwnPropertyDescriptor(Response.prototype, "body");
  Object.defineProperty(Response.prototype, "body", { ...descriptor, get() {
    const body = Reflect.apply(descriptor.get, this, []);
    try {
      const url = new URL(this.url);
      if (body && url.origin === location.origin && this.headers.get("content-type")?.startsWith("text/x-component")) {
        streams.set(body, { url: url.href, status: this.status, ray: this.headers.get("cf-ray") });
      }
    } catch { /* Invalid metadata must not change a native getter. */ }
    return body;
  } });
  const getReader = ReadableStream.prototype.getReader;
  ReadableStream.prototype.getReader = function (...args) {
    const reader = Reflect.apply(getReader, this, args);
    const metadata = streams.get(this);
    if (metadata) readers.set(reader, metadata);
    return reader;
  };
  for (const prototype of [ReadableStreamDefaultReader.prototype, ReadableStreamBYOBReader.prototype]) {
    const read = prototype.read;
    prototype.read = function (...args) {
      const promise = Reflect.apply(read, this, args);
      const metadata = readers.get(this);
      if (metadata) void promise.then(result => {
        if (result.done && !completed.has(this)) {
          completed.add(this);
          emit({ kind: "response-reader-complete", ...metadata });
        }
      }, () => emit({ kind: "response-reader-error", ...metadata })).catch(() => {});
      return promise;
    };
  }
  for (const [prototype, map, kind] of [
    [ReadableStream.prototype, streams, "response-stream-cancel"],
    [ReadableStreamDefaultReader.prototype, readers, "response-reader-cancel"],
    [ReadableStreamBYOBReader.prototype, readers, "response-reader-cancel"],
  ]) {
    const cancel = prototype.cancel;
    prototype.cancel = function (...args) {
      const promise = Reflect.apply(cancel, this, args);
      try { const metadata = map.get(this); if (metadata) emit({ kind, ...metadata }); }
      catch { /* Observation cannot alter cancellation. */ }
      const metadata = map.get(this);
      if (metadata) void promise.catch(() => emit({ kind: "response-cancel-error", ...metadata })).catch(() => {});
      return promise;
    };
  }
}

export async function observeChromiumRequests(page, onEvent = () => {}) {
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  const requests = new Set();
  const digest = value => createHash("sha256").update(value).digest("hex");
  const add = event => { const observed = { at: Date.now(), ...event }; if (events.length < 1500) events.push(observed); onEvent(observed); };
  cdp.on("Network.requestWillBeSent", event => {
    const url = new URL(event.request.url);
    if (url.origin !== new URL(page.url()).origin || !url.searchParams.has("_rsc")) return;
    requests.add(event.requestId);
    const headers = Object.fromEntries(Object.entries(event.request.headers).map(([key, value]) => [key.toLowerCase(), value]));
    add({ kind: "request", id: event.requestId, type: event.type, wallTime: event.wallTime, loaderId: event.loaderId,
      path: url.pathname, requestKey: digest(url.href), initiator: { type: event.initiator.type, requestId: event.initiator.requestId },
      headers: Object.fromEntries(["rsc", "next-router-prefetch", "next-router-segment-prefetch", "if-none-match", "if-modified-since", "cache-control"].filter(key => key in headers).map(key => [key, headers[key]])) });
  });
  cdp.on("Network.responseReceived", event => {
    if (!requests.has(event.requestId)) return;
    const headers = Object.fromEntries(Object.entries(event.response.headers).map(([key, value]) => [key.toLowerCase(), value]));
    add({ kind: "response", id: event.requestId, status: event.response.status, type: event.type,
      fromDiskCache: event.response.fromDiskCache, fromServiceWorker: event.response.fromServiceWorker,
      headers: Object.fromEntries(["cf-ray", "cache-control", "age", "etag", "content-type"].filter(key => key in headers).map(key => [key, headers[key]])) });
  });
  for (const [name, kind] of [["requestServedFromCache", "cached"], ["loadingFinished", "finished"], ["loadingFailed", "failed"]]) {
    cdp.on(`Network.${name}`, event => { if (requests.has(event.requestId)) add({ kind, id: event.requestId, error: event.errorText, canceled: event.canceled, encodedDataLength: event.encodedDataLength }); });
  }
  await cdp.send("Network.enable");
  return { cdp, events };
}

function backgroundRevalidation(probe, failure) {
  if (failure.resource !== "other" || failure.error !== "net::ERR_ABORTED" || failure.method !== "GET" || !failure.rsc || !failure.prefetch) return null;
  const requests = probe.trace.filter(event => event.kind === "native-request" && event.requestKey === failure.requestKey
    && event.type === "Other" && event.initiator?.type === "other" && event.at <= failure.at);
  if (requests.length !== 1) return null;
  const request = requests[0];
  if (request.headers?.rsc !== "1" || request.headers?.["next-router-prefetch"] !== "1") return null;
  const response = probe.trace.find(event => event.kind === "native-response" && event.id === request.id);
  const cancelledBeforeHeaders = !response && probe.trace.some(event => event.kind === "native-failed" && event.id === request.id
    && event.at >= request.at && event.canceled === true && event.error === "net::ERR_ABORTED");
  if (!cancelledBeforeHeaders && (response?.status !== 200 || response.type !== "Other" || response.at > failure.at || !response.headers?.["content-type"]?.startsWith("text/x-component")
    || !/(?:^|,)\s*stale-while-revalidate=\d+(?:\s*,|$)/i.test(response.headers["cache-control"] ?? ""))) return null;
  if (probe.trace.some(event => event.kind === "native-failed" && event.id === request.id && event.error !== "net::ERR_ABORTED")) return null;
  const cached = probe.trace.filter(event => event.kind === "native-response" && event.type === "Fetch"
    && event.fromDiskCache === true && event.status === 200 && event.at <= request.at
    && event.headers?.["content-type"]?.startsWith("text/x-component")
    && /(?:^|,)\s*stale-while-revalidate=\d+(?:\s*,|$)/i.test(event.headers["cache-control"] ?? ""));
  for (const cachedResponse of cached.reverse()) {
    const original = probe.trace.find(event => event.kind === "native-request" && event.id === cachedResponse.id);
    if (original?.requestKey !== failure.requestKey || original.loaderId !== request.loaderId || original.initiator?.type !== "script") continue;
    if (!probe.trace.some(event => event.kind === "native-finished" && event.id === original.id && event.at <= request.at)) continue;
    const ray = cachedResponse.headers["cf-ray"];
    if (!/^[a-f0-9]{16}(?:-[a-z]{3})?$/i.test(ray ?? "")) continue;
    const sameRead = event => event.requestKey === failure.requestKey && event.ray === ray && event.at >= original.wallTime * 1000 && event.at <= failure.at;
    if (probe.trace.some(event => ["response-reader-error", "response-cancel-error"].includes(event.kind) && sameRead(event))) continue;
    if (!probe.trace.some(event => event.kind === "response-reader-complete" && event.status === 200 && sameRead(event))) continue;
    return { requestId: failure.requestId, requestKey: failure.requestKey, nativeRequestId: request.id,
      cachedRequestId: original.id, ray, reason: cancelledBeforeHeaders
        ? "chromium-background-swr-cancelled-before-headers" : "chromium-background-swr-revalidation" };
  }
  return null;
}

export function networkVerdict(probe) {
  const classified = [];
  const failures = probe.failed.filter(failure => {
    const background = backgroundRevalidation(probe, failure);
    if (background) { classified.push(background); return false; }
    const response = probe.trace.find(event => event.kind === "response" && event.requestId === failure.requestId);
    if (!["net::ERR_ABORTED", "Load request cancelled"].includes(failure.error) || failure.method !== "GET" || !failure.rsc || !failure.prefetch
      || response?.status !== 200 || !response.contentType?.startsWith("text/x-component")
      || !/^[a-f0-9]{16}(?:-[a-z]{3})?$/i.test(response.ray ?? "")) return true;
    // A unique edge request reference binds the native reader observation to
    // this response. URL/status alone cannot prove which request was consumed.
    if (probe.trace.filter(event => event.kind === "response" && event.ray === response.ray).length !== 1) return true;
    if (probe.trace.some(event => ["response-reader-error", "response-cancel-error"].includes(event.kind)
      && event.requestKey === failure.requestKey && event.ray === response.ray)) return true;
    // Native browser timestamps precede delivery of Playwright's request event.
    // Compare reader intent with the observed fetch start in that same clock.
    const browserStarts = probe.trace.filter(event => event.kind === "prefetch-start" && event.method === "GET"
      && event.requestKey === failure.requestKey && event.at <= failure.at);
    const startedAt = browserStarts.length ? Math.max(...browserStarts.map(event => event.at)) : failure.startedAt;
    const intent = probe.trace.find(event => ["response-reader-complete", "response-reader-cancel", "response-stream-cancel"].includes(event.kind)
      && event.requestKey === failure.requestKey && event.ray === response.ray && event.status === 200
      && event.at >= startedAt && event.at <= failure.at);
    if (!intent) return true;
    classified.push({ requestId: failure.requestId, requestKey: failure.requestKey, ray: response.ray, reason: intent.kind });
    return false;
  });
  return { failures, classified, passed: !probe.errors.length && failures.length === 0 && probe.counts.failed === probe.failed.length };
}

export async function instrument(page) {
  const trace = [];
  const errors = [];
  const failed = [];
  const counts = { events: 0, failed: 0 };
  const path = value => { try { const url = new URL(value); return url.origin + url.pathname; } catch { return value; } };
  const requestKey = value => createHash("sha256").update(value).digest("hex");
  const started = new WeakMap();
  const requestIds = new WeakMap();
  let requestSequence = 0;
  const add = event => { counts.events++; if (trace.length < 3000) trace.push({ at: Date.now(), ...event }); };
  page.on("pageerror", error => { errors.push(error.message); add({ kind: "pageerror", message: error.message }); });
  page.on("requestfailed", request => { const event = { at: Date.now(), kind: "requestfailed", url: path(request.url()), resource: request.resourceType(), error: request.failure()?.errorText,
    rsc: request.headers().rsc === "1", prefetch: request.headers()["next-router-prefetch"] === "1",
    requestKey: requestKey(request.url()), requestId: requestIds.get(request), method: request.method(), startedAt: started.get(request),
    queryKeys: [...new URL(request.url()).searchParams.keys()].slice(0, 6) };
    counts.failed++; if (failed.length < 3000) failed.push(event); add(event); });
  page.on("request", request => { started.set(request, Date.now()); requestIds.set(request, ++requestSequence); if (request.isNavigationRequest()) add({ kind: "navigation-request", url: path(request.url()) }); });
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) add({ kind: "navigation-commit", url: path(frame.url()) }); });
  page.on("response", response => {
    const request = response.request();
    if (response.status() >= 400 || request.headers().rsc === "1" || new URL(request.url()).pathname.startsWith("/_next/static/")) {
      add({ kind: "response", status: response.status(), url: path(response.url()), requestKey: requestKey(request.url()),
        requestId: requestIds.get(request), method: request.method(), contentType: response.headers()["content-type"], ray: response.headers()["cf-ray"], fromServiceWorker: response.fromServiceWorker() });
    }
  });
  await page.exposeFunction("recordLifecycle", event => add({ kind: "lifecycle", event }));
  await page.exposeBinding("recordFetchObservation", ({ frame }, event) => {
    if (frame !== page.mainFrame()) return;
    // Full query values exist only inside this callback, never in artifacts.
    add({ ...event, url: path(event.url), requestKey: requestKey(event.url) });
  });
  await page.addInitScript(observeFetchSignals);
  await page.addInitScript(observeResponseStreams);
  await page.addInitScript(observePerformanceTiming);
  await page.addInitScript(() => {
    for (const event of ["pagehide", "beforeunload"]) window.addEventListener(event, () => { void window.recordLifecycle(event); });
    navigator.serviceWorker?.addEventListener("controllerchange", () => { void window.recordLifecycle("service-worker-controllerchange"); });
  });
  if (engine === "chromium") await observeChromiumRequests(page, event => add({ ...event, kind: `native-${event.kind}` }));
  return { trace, errors, failed, counts, mark: event => add({ kind: "harness", event }) };
}

// Cold performance samples intentionally exclude service workers. Playwright's
// block mode leaves register() present but resolves it with undefined, which
// creates a synthetic application error. Model an absent capability instead.
export function omitServiceWorkerCapability() {
  for (let owner = navigator; owner; owner = Object.getPrototypeOf(owner)) {
    if (Object.hasOwn(owner, "serviceWorker")) {
      Reflect.deleteProperty(owner, "serviceWorker");
      break;
    }
  }
  if ("serviceWorker" in navigator) throw new Error("Cannot isolate service worker capability");
}

// Capture readiness in the page clock, independently of source-verification and
// driver round trips. Both full instrumentation and timing controls use this.
export function observePerformanceTiming() {
  const state = window.gtgPerformance = { lcpMs: null, interactions: [], readyMs: null, startupMs: null, startupError: null };
  const domReady = document.readyState === "loading"
    ? new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }))
    : Promise.resolve();
  const appReady = new Promise(resolve => window.addEventListener("gtg:app-ready", () => {
    state.readyMs = performance.now();
    resolve();
  }, { once: true }));
  Promise.all([domReady, appReady])
    .then(() => document.fonts.ready)
    .then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    .then(() => { state.startupMs = performance.now(); })
    .catch(error => { state.startupError = String(error); });
  if (PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) {
    new PerformanceObserver(list => { state.lcpMs = list.getEntries().at(-1).startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  }
  window.addEventListener("click", () => {
    const start = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => state.interactions.push(performance.now() - start)));
  }, true);
}

export async function startupMeasurement(page) {
  await page.waitForFunction(() => window.gtgPerformance.startupMs !== null || window.gtgPerformance.startupError !== null, undefined, { timeout: 15_000 });
  return page.evaluate(() => {
    if (window.gtgPerformance.startupError !== null) throw new Error(window.gtgPerformance.startupError);
    const navigation = performance.getEntriesByType("navigation")[0];
    const assets = performance.getEntriesByType("resource").filter(entry => /\/_next\/static\/.*\.(?:js|css)(?:\?|$)/.test(entry.name));
    const js = assets.filter(entry => /\.js(?:\?|$)/.test(entry.name));
    const css = assets.filter(entry => /\.css(?:\?|$)/.test(entry.name));
    const loadedStyles = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const observedMs = performance.now();
    return { startupMs: window.gtgPerformance.startupMs, observedMs,
      driverDelayMs: observedMs - window.gtgPerformance.startupMs, domReadyMs: navigation.domContentLoadedEventEnd,
      appReadyMs: window.gtgPerformance.readyMs, lcpMs: window.gtgPerformance.lcpMs,
      decodedJsBytes: js.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      decodedCssBytes: css.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      resources: assets.length, stylesReady: loadedStyles.length > 0 && loadedStyles.every(link => Boolean(link.sheet)) };
  });
}

export async function timedClick(page, locator) {
  const before = await page.evaluate(() => window.gtgPerformance.interactions.length);
  await locator.click();
  await page.waitForFunction(count => window.gtgPerformance.interactions.length > count, before);
  return page.evaluate(count => window.gtgPerformance.interactions[count], before);
}

// A two-frame click timer can finish before Next commits a hash navigation.
// Measure the completed fragment scroll and two subsequent stable frames.
export function observeFragmentNavigation(expected) {
  const state = window.gtgFragmentNavigation = { status: "armed" };
  let frame;
  let previous;
  let stable = 0;
  const cleanup = () => {
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    window.removeEventListener("click", clicked, true);
  };
  const timeout = setTimeout(() => {
    state.status = "failed";
    state.error = "Fragment navigation did not finish within ten seconds";
    cleanup();
  }, 10_000);
  const sample = () => {
    const target = document.getElementById(expected.fragment);
    const top = target?.getBoundingClientRect().top;
    const offset = target ? (parseFloat(getComputedStyle(target).scrollMarginTop) || 0)
      + (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) : 0;
    const desired = Math.max(0, Math.min((top ?? 0) + scrollY - offset, document.documentElement.scrollHeight - innerHeight));
    const reached = target && location.pathname === expected.pathname && location.search === expected.search
      && location.hash === expected.hash && Math.abs(scrollY - desired) <= 1;
    if (reached) {
      state.reachedMs ??= performance.now() - state.startedAt;
      stable = previous && Math.abs(previous.top - top) <= 1 && Math.abs(previous.y - scrollY) <= 1 ? stable + 1 : 0;
      previous = { top, y: scrollY };
      if (stable >= 2) {
        state.status = "complete";
        state.milliseconds = performance.now() - state.startedAt;
        state.targetTop = top;
        cleanup();
        return;
      }
    } else { previous = undefined; stable = 0; }
    frame = requestAnimationFrame(sample);
  };
  function clicked(event) {
    if (!event.isTrusted) return;
    window.removeEventListener("click", clicked, true);
    state.status = "running";
    state.startedAt = performance.now();
    frame = requestAnimationFrame(sample);
  }
  window.addEventListener("click", clicked, true);
}

export async function timedFragmentClick(page, locator) {
  const url = new URL(await locator.getAttribute("href"), page.url());
  assert.equal(url.origin, new URL(page.url()).origin, "Fragment timing requires a same-origin link");
  assert(url.hash, "Fragment timing requires a target");
  await page.evaluate(observeFragmentNavigation, {
    fragment: decodeURIComponent(url.hash.slice(1)), hash: url.hash, pathname: url.pathname, search: url.search,
  });
  await locator.click();
  await page.waitForFunction(() => ["complete", "failed"].includes(window.gtgFragmentNavigation.status), undefined, { timeout: 11_000 });
  const result = await page.evaluate(() => window.gtgFragmentNavigation);
  assert.equal(result.status, "complete", result.error);
  return result.milliseconds;
}
