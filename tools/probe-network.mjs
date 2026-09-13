import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, instrument, networkVerdict, output } from "./browser-evidence.mjs";

// Diagnostic controls, not release check certificates. No failed event from
// the application is filtered based on this probe's result.
assert(candidates.length, "Network probe requires a candidate");
await mkdir(output, { recursive: true });
const result = { engine, site: candidates[0].site };
async function traceNativeRequests(context, page, origin) {
  const cdp = await context.newCDPSession(page);
  const events = [];
  const requests = new Set();
  const digest = value => createHash("sha256").update(value).digest("hex");
  const add = event => { if (events.length < 1500) events.push({ at: Date.now(), ...event }); };
  cdp.on("Network.requestWillBeSent", event => {
    const url = new URL(event.request.url);
    if (url.origin !== origin || !url.searchParams.has("_rsc")) return;
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

const browser = await ({ chromium, webkit })[engine].launch();
let server;
try {
  const casino = candidates.find(candidate => candidate.site === "teenpatti");
  if (engine === "chromium" && casino && process.argv.includes("--trace-casino")) {
    result.casinoRequests = [];
    for (const mode of ["worker-cache", "no-worker-cache", "no-worker-no-cache"]) {
      const context = await browser.newContext({ serviceWorkers: mode === "worker-cache" ? "allow" : "block", viewport: { width: 2560, height: 1440 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      const probe = await instrument(page);
      const { cdp, events } = await traceNativeRequests(context, page, casino.origin);
      if (mode === "no-worker-no-cache") await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      let flowError;
      let networkIdle;
      try {
        await page.goto(casino.origin, { waitUntil: "networkidle", timeout: 15_000 });
        await page.locator(".casino-feature-picker").getByRole("button", { name: "Roulette", exact: true }).click();
        await page.locator(".casino-enter").click();
        await page.getByRole("button", { name: "Spin", exact: true }).click();
        await page.locator(".casino-proof").waitFor();
        await page.locator('.casino-header a[href="/"]').click();
        await page.waitForURL(casino.origin + "/");
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
        probe.mark("diagnostic-reload");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload({ waitUntil: "load" });
        await page.locator(".casino-progress-details summary").click();
        await page.locator(".casino-progress-game").getByRole("link", { name: "Roulette", exact: true }).click();
        await page.waitForURL(casino.origin + "/casino/roulette");
        networkIdle = await page.waitForLoadState("networkidle", { timeout: 1500 }).then(() => true, () => false);
      } catch (error) {
        flowError = String(error);
      } finally {
        probe.mark("context-close-start");
        await context.close();
        result.casinoRequests.push({ mode, networkIdle, flowError, events, trace: probe.trace, failed: probe.failed });
      }
    }
  }
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    await page.goto(candidates[0].origin, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const asset = await page.locator('script[src*="/_next/static/"]').first().getAttribute("src");
    assert(asset, "Candidate has no script asset");
    const target = new URL(asset, candidates[0].origin);
    target.searchParams.set("__qa_head", "calibration");
    const events = [];
    page.on("response", response => {
      if (response.url() === target.href) events.push({ kind: "response", status: response.status(), method: response.request().method(), contentType: response.headers()["content-type"] });
    });
    page.on("requestfailed", request => {
      if (request.url() === target.href) events.push({ kind: "requestfailed", method: request.method(), error: request.failure()?.errorText });
    });
    const returned = await page.evaluate(async url => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal });
        return { resolved: true, status: response.status, type: response.headers.get("content-type"), bodyBytes: (await response.arrayBuffer()).byteLength, signalAborted: controller.signal.aborted };
      } catch (error) { return { resolved: false, name: error.name, signalAborted: controller.signal.aborted }; }
      finally { clearTimeout(timeout); }
    }, target.href);
    await page.waitForTimeout(100);
    result.head = { asset: target.pathname, returned, events };
  } finally { await context.close(); }

  const worker = `let intercepted=0;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>event.ports[0].postMessage({online:self.navigator.onLine,intercepted}));
self.addEventListener('fetch',event=>{if(new URL(event.request.url).pathname==='/oracle'){intercepted++;event.respondWith(new Response('worker-answer'));}});`;
  const cacheRequests = { "/swr": 0, "/revalidate": 0 };
  server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const pathname = new URL(request.url, "http://fixture.test").pathname;
    if (pathname in cacheRequests) {
      const count = ++cacheRequests[pathname];
      response.setHeader("Content-Type", "text/x-component");
      response.setHeader("Cache-Control", pathname === "/swr" ? "s-maxage=31536000, stale-while-revalidate=2592000" : "max-age=0, must-revalidate");
      response.setHeader("CF-Ray", `${count.toString(16).padStart(16, "0")}-BOM`);
      response.end(`0:fixture-${count}\n`);
      return;
    }
    if (request.url.startsWith("/stream-")) {
      response.setHeader("Content-Type", "text/x-component");
      response.setHeader("CF-Ray", ({ "/stream-cancelled": "0000000000000001-BOM", "/stream-complete": "0000000000000002-BOM", "/stream-broken": "0000000000000003-BOM" })[request.url]);
      response.write("0:first-chunk\n");
      const timeout = setTimeout(() => {
        if (request.url === "/stream-broken") response.destroy();
        else response.end("1:last-chunk\n");
      }, 200);
      response.on("close", () => clearTimeout(timeout));
      return;
    }
    response.setHeader("Content-Type", request.url === "/sw.js" ? "text/javascript" : "text/html");
    response.end(request.url === "/sw.js" ? worker : "<!doctype html><title>Offline control</title><p>Offline control</p>");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  if (engine === "chromium" && process.argv.includes("--trace-casino")) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const probe = await instrument(page);
    const { events } = await traceNativeRequests(context, page, origin);
    try {
      await page.goto(origin, { waitUntil: "load" });
      const values = {};
      for (const path of Object.keys(cacheRequests)) {
        values[path] = [];
        for (let index = 0; index < 3; index++) {
          values[path].push(await page.evaluate(async path => {
            const response = await fetch(path + "?_rsc=control", { headers: { rsc: "1", "next-router-prefetch": "1" } });
            const reader = response.body.getReader();
            let body = "";
            while (true) { const { done, value } = await reader.read(); if (done) break; body += new TextDecoder().decode(value); }
            return body;
          }, path));
          await page.waitForTimeout(index === 0 ? 1100 : 200);
        }
      }
      result.cacheControl = { values, serverRequests: cacheRequests, events, trace: probe.trace, failed: probe.failed };
    } finally { await context.close(); }
  }
  const streamContext = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await streamContext.newPage();
    const probe = await instrument(page);
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "load" });
    const outcomes = await page.evaluate(async () => {
      const headers = { rsc: "1", "next-router-prefetch": "1" };
      const cancelled = await fetch("/stream-cancelled", { headers });
      const reader = cancelled.body.getReader();
      await reader.read();
      await reader.cancel();
      const completeReader = (await fetch("/stream-complete", { headers })).body.getReader();
      let complete = "";
      while (true) { const { done, value } = await completeReader.read(); if (done) break; complete += new TextDecoder().decode(value); }
      let failure;
      try { await (await fetch("/stream-broken", { headers })).text(); }
      catch (error) { failure = error.name; }
      return { complete, failure };
    });
    await page.waitForTimeout(100);
    const verdict = networkVerdict(probe);
    result.streamControls = { outcomes, trace: probe.trace, failed: probe.failed, verdict };
    assert(outcomes.complete.includes("last-chunk") && outcomes.failure, "Stream controls did not complete and fail independently");
    assert(probe.trace.some(event => event.kind === "response-reader-cancel" && event.url.endsWith("/stream-cancelled")), "Explicit cancellation was not observed");
    assert(probe.trace.some(event => event.kind === "response-reader-complete" && event.url.endsWith("/stream-complete")), "Complete native stream consumption was not observed");
    assert(!probe.trace.some(event => /response-(?:reader|stream)-cancel/.test(event.kind) && event.url.endsWith("/stream-broken")), "Network failure was falsely classified as cancellation");
    assert(probe.failed.some(event => event.url.endsWith("/stream-broken")), "Network failure detector missed the broken response");
    assert(!verdict.passed && verdict.failures.some(event => event.url.endsWith("/stream-broken")), "Broken transport was waived");
    assert(!verdict.failures.some(event => event.url.endsWith("/stream-cancelled")), "Observed same-request cancellation was not correlated");
  } finally { await streamContext.close(); }
  const workerContext = await browser.newContext({ serviceWorkers: "allow" });
  try {
    const page = await workerContext.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "load" });
    await page.evaluate(() => navigator.serviceWorker.register("/sw.js"));
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    async function observe() {
      return page.evaluate(async () => {
        const channel = new MessageChannel();
        const workerState = new Promise(resolve => {
          const timeout = setTimeout(() => resolve({ messageTimedOut: true }), 3000);
          channel.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data); };
        });
        navigator.serviceWorker.controller.postMessage("state", [channel.port2]);
        const state = { documentOnline: navigator.onLine, worker: await workerState };
        try { state.answer = await (await fetch("/oracle", { signal: AbortSignal.timeout(3000) })).text(); }
        catch (error) { state.fetchError = { name: error.name, message: error.message }; }
        return state;
      });
    }
    result.onlineControl = await observe();
    assert.equal(result.onlineControl.answer, "worker-answer", "Control worker did not intercept while online");
    await workerContext.setOffline(true);
    result.offlineControl = await observe();
    await workerContext.setOffline(false);
    result.restoredControl = await observe();
    assert.equal(result.restoredControl.answer, "worker-answer", "Control worker did not recover after emulation");
  } finally { await workerContext.close(); }
} finally {
  await writeFile(new URL(`network-control-${engine}.json`, output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ engine, site: result.site, modes: result.casinoRequests?.map(({ mode, networkIdle, flowError, failed }) => ({ mode, networkIdle, flowError, failed: failed.length })), streamControls: result.streamControls?.verdict }));
  await browser.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
