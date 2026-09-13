import assert from "node:assert/strict";
import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, webkit } from "playwright";
import { candidates, engine, output, observeSource, recordEvidence } from "./browser-evidence.mjs";

assert(candidates.length, "PWA release checks require immutable candidates");
await mkdir(output, { recursive: true });
const report = [];
const browser = await ({ chromium, webkit })[engine].launch({ timeout: 20_000 });

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "error" });
  assert(response.ok, `Candidate resource failed: ${response.status}`);
  const text = await response.text();
  assert(text.length < 2_000_000, "Candidate resource exceeds fixture limit");
  return text;
}

async function offlineCandidate(candidate, result) {
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(candidate.origin, { waitUntil: "domcontentloaded", timeout: 20_000 });
    result.observedSourceHead = await observeSource(page, candidate.site);
    await page.evaluate(async () => {
      await Promise.race([
        (async () => { await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }); await navigator.serviceWorker.ready; })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Worker registration exceeded 15 seconds")), 15_000)),
      ]);
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    // Activation finishes coherent precaching before claiming this document.
    const cacheState = await page.evaluate(async () => {
      const names = await caches.keys();
      const paths = [];
      for (const name of names) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
      return { names, paths };
    });
    assert(cacheState.paths.some(path => path === "/"), "Candidate has no complete offline start document");
    assert(!cacheState.paths.some(path => /^\/(api|account|r)(\/|$)/.test(path)), "Private response found in worker cache");
    result.cacheEntries = cacheState.paths.length;
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    assert.equal(await observeSource(page, candidate.site), candidate.sourceHead);
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => Boolean(link.sheet)));
    assert(styles.length > 0 && styles.every(Boolean), "Offline page lost required stylesheets");
    await page.waitForFunction(() => Reflect.get(window, "gtg:app-ready") === true);
    assert.deepEqual(errors, [], "Offline candidate raised runtime errors");
    await page.screenshot({ path: new URL(`pwa-${candidate.site}-${engine}-offline.jpg`, output).pathname, fullPage: true });
    result.offline = "passed";
  } finally { await context.close(); }
}

async function updateCandidate(candidate, result) {
  const source = await fetchText(`${candidate.origin}/sw.js`);
  const match = /const VERSION = ("[^"\n]+");/.exec(source);
  assert(match, "Candidate worker has no generated version");
  const version = JSON.parse(match[1]);
  assert(version.endsWith(candidate.sourceHead.slice(0, 8)), "Candidate worker version differs from rendered source");
  const oldVersion = version.replace(/[^-]+$/, "00000000");
  assert.notEqual(version, oldVersion);
  const predecessor = source.replace(match[0], `const VERSION = ${JSON.stringify(oldVersion)};`);
  const css = "/_next/static/chunks/0123456789abcdef.css";
  const js = "/_next/static/chunks/0123456789abcdef.js";
  let replacement = false;
  const workerRequests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://fixture");
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/sw.js") {
      workerRequests.push(replacement ? "candidate" : "predecessor");
      response.setHeader("Content-Type", "text/javascript");
      response.end(replacement ? source : predecessor);
    } else if (url.pathname === css) {
      response.setHeader("Content-Type", "text/css");
      response.end("body{background:rgb(220,235,250);font:18px system-ui}");
    } else if (url.pathname === js) {
      response.setHeader("Content-Type", "text/javascript");
      response.end("window.fixtureReady=true;");
    } else if (url.pathname.startsWith("/api/")) {
      response.writeHead(204); response.end();
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${css}"><script defer src="${js}"></script><h1>Worker lifecycle fixture</h1><input id="draft" value="retained"><span class="build-stamp" title="${candidate.sourceHead}">${candidate.sourceHead}</span>`);
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  try {
    await page.goto(origin, { waitUntil: "load", timeout: 15_000 });
    await page.evaluate(async () => {
      await Promise.race([
        (async () => { await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }); await navigator.serviceWorker.ready; })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Worker registration exceeded 15 seconds")), 15_000)),
      ]);
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.locator("#draft").fill("an unfinished local hand");
    await page.evaluate(() => { window.controllerChanges = 0; navigator.serviceWorker.addEventListener("controllerchange", () => window.controllerChanges++); });
    replacement = true;
    await page.evaluate(async () => {
      await Promise.race([
        (async () => { await (await navigator.serviceWorker.getRegistration()).update(); })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Worker update exceeded 15 seconds")), 15_000)),
      ]);
    });
    await page.waitForFunction(() => window.controllerChanges === 1);
    assert.equal(await page.locator("#draft").inputValue(), "an unfinished local hand", "Worker update reloaded healthy state");
    const cacheNames = await page.evaluate(() => caches.keys());
    assert(cacheNames.includes(`${oldVersion}-static`) && cacheNames.includes(`${version}-static`), "Update lost a required cache generation");
    await context.setOffline(true);
    assert.equal(await page.evaluate(async path => (await fetch(path)).status, css), 200, "Existing document lost its immutable CSS");
    await page.reload({ waitUntil: "load", timeout: 15_000 });
    assert.equal(await page.evaluate(() => window.fixtureReady), true, "Offline replacement lost its required script");
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(220, 235, 250)", "Offline replacement lost its required CSS");
    await page.screenshot({ path: new URL(`pwa-${candidate.site}-${engine}-update.jpg`, output).pathname });
    result.update = "passed";
    result.workerSha256 = createHash("sha256").update(source).digest("hex");
    result.workerRequests = workerRequests;
    result.updateFixture = "Exact fetched candidate worker; predecessor changes only VERSION; real install/activation/caches/offline network in browser";
  } finally {
    await context.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

try {
  for (const candidate of candidates) {
    const result = { site: candidate.site, engine, offline: "failed", update: "failed" };
    report.push(result);
    try { await offlineCandidate(candidate, result); }
    catch (error) { result.offlineFailure = String(error); process.exitCode = 1; }
    try { await updateCandidate(candidate, result); }
    catch (error) { result.updateFailure = String(error); process.exitCode = 1; }
    if (result.observedSourceHead) await recordEvidence(candidate.site, result.observedSourceHead,
      [{ id: "offline", status: result.offline }, { id: "update", status: result.update }]);
    await writeFile(new URL(`pwa-${engine}.json`, output), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(result));
  }
} finally { await browser.close(); }
