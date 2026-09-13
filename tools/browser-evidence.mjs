import assert from "node:assert/strict";
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

export async function observeSource(page, site) {
  const commits = await page.locator('.build-stamp[title], .play-num[title]').evaluateAll(elements =>
    [...new Set(elements.map(element => element.getAttribute("title")).filter(value => /^[a-f0-9]{40}$/i.test(value ?? "")))]);
  assert.equal(commits.length, 1, "Rendered page must expose one full source commit");
  const candidate = candidates.find(item => item.site === siteKey(site));
  if (candidate) assert.equal(commits[0], candidate.sourceHead, "Rendered source differs from the certified candidate");
  return commits[0];
}

export async function recordEvidence(site, observedSourceHead, checks = [], measurements = [], origin) {
  const bound = candidates.find(item => item.site === siteKey(site));
  if (!bound && process.env.BASELINE_ONLY !== "true") return;
  // Partial baseline records omit the candidate tuple and cannot certify deploys.
  const candidate = bound ?? { site: siteKey(site), sourceHead: observedSourceHead, origin };
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

export async function instrument(page) {
  const trace = [];
  const errors = [];
  const failed = [];
  const path = value => { try { const url = new URL(value); return url.origin + url.pathname; } catch { return value; } };
  const add = event => { trace.push({ at: Date.now(), ...event }); };
  page.on("pageerror", error => { errors.push(error.message); add({ kind: "pageerror", message: error.message }); });
  page.on("requestfailed", request => { const event = { kind: "requestfailed", url: path(request.url()), resource: request.resourceType(), error: request.failure()?.errorText }; failed.push(event); add(event); });
  page.on("request", request => { if (request.isNavigationRequest()) add({ kind: "navigation-request", url: path(request.url()) }); });
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) add({ kind: "navigation-commit", url: path(frame.url()) }); });
  page.on("response", response => { if (response.status() >= 400) add({ kind: "http-error", status: response.status(), url: path(response.url()) }); });
  await page.exposeFunction("recordLifecycle", event => add({ kind: "lifecycle", event }));
  await page.addInitScript(() => {
    window.gtgPerformance = { lcpMs: null, interactions: [], readyMs: null };
    for (const event of ["pagehide", "beforeunload"]) window.addEventListener(event, () => { void window.recordLifecycle(event); });
    window.addEventListener("gtg:app-ready", () => { window.gtgPerformance.readyMs = performance.now(); }, { once: true });
    if (PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) {
      new PerformanceObserver(list => { window.gtgPerformance.lcpMs = list.getEntries().at(-1).startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    }
    window.addEventListener("click", () => {
      const start = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => window.gtgPerformance.interactions.push(performance.now() - start)));
    }, true);
  });
  return { trace, errors, failed };
}

export async function startupMeasurement(page) {
  await page.waitForFunction(() => window.gtgPerformance.readyMs !== null, undefined, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const assets = performance.getEntriesByType("resource").filter(entry => /\/_next\/static\/.*\.(?:js|css)(?:\?|$)/.test(entry.name));
    const js = assets.filter(entry => /\.js(?:\?|$)/.test(entry.name));
    const css = assets.filter(entry => /\.css(?:\?|$)/.test(entry.name));
    const loadedStyles = [...document.querySelectorAll('link[rel="stylesheet"]')];
    return { startupMs: performance.now(), domReadyMs: navigation.domContentLoadedEventEnd,
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
