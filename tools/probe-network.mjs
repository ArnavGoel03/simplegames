import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, output } from "./browser-evidence.mjs";

// Diagnostic controls, not release check certificates. No failed event from
// the application is filtered based on this probe's result.
assert(candidates.length, "Network probe requires a candidate");
await mkdir(output, { recursive: true });
const result = { engine, site: candidates[0].site };
const browser = await ({ chromium, webkit })[engine].launch();
let server;
try {
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
  server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", request.url === "/sw.js" ? "text/javascript" : "text/html");
    response.end(request.url === "/sw.js" ? worker : "<!doctype html><title>Offline control</title><p>Offline control</p>");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
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
  console.log(JSON.stringify(result));
  await browser.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
