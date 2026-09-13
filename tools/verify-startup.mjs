import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { ASSET_RECOVERY_SCRIPT_PROPS, assetRecoverySource } from "../src/lib/pwa/asset-recovery.ts";

// Real parser/network fixture: a preceding stylesheet and unrelated async
// script never finish. The recovery script must still execute and diagnose.
const engine = process.env.BROWSER_ENGINE || "chromium";
assert(["chromium", "webkit"].includes(engine));
const results = [];
const pending = new Set();
let heads = 0;
const source = assetRecoverySource("fixture", "window.bootstrapRan = true;");
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture");
  if (url.pathname.startsWith("/_next/static/")) {
    if (req.method === "HEAD") {
      heads++;
      res.writeHead(url.pathname.includes("healthy") ? 200 : 404, { "Content-Type": "text/css" });
      res.end();
    } else {
      pending.add(res);
      res.on("close", () => pending.delete(res));
    }
    return;
  }
  res.setHeader("Content-Type", "text/html");
  if (url.searchParams.has("__gtg_recovery")) {
    res.end('<!doctype html><title>Recovered</title><style>body{background:rgb(220,235,250)}</style><h1>Recovered</h1>');
    return;
  }
  const classic = url.pathname === "/classic";
  const healthy = url.pathname === "/healthy";
  const props = classic ? "" : `type="${ASSET_RECOVERY_SCRIPT_PROPS.type}" ${ASSET_RECOVERY_SCRIPT_PROPS.async ? "async" : ""}`;
  res.end(`<!doctype html><head><link rel="stylesheet" href="/_next/static/${healthy ? "healthy" : "retired"}.css"><script async src="/_next/static/stalled.js"></script><script ${props}>${source}</script></head><body><h1>Waiting</h1></body>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await ({ chromium, webkit })[engine].launch();
const output = new URL("../.audit/visual/", import.meta.url);
await mkdir(output, { recursive: true });
try {
  for (const scenario of ["classic", "retired", "healthy"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    heads = 0;
    await page.goto(`${origin}/${scenario}?mode=chips#table`, { waitUntil: "commit", timeout: 10_000 });
    if (scenario === "classic") {
      // Positive calibration: the previous classic mount is parser blocked.
      await page.waitForTimeout(3_000);
      assert.equal(await page.evaluate(() => window.bootstrapRan), undefined);
      assert.equal(heads, 0);
      assert.equal(new URL(page.url()).pathname, "/classic");
    } else if (scenario === "retired") {
      await page.waitForURL(url => url.searchParams.has("__gtg_recovery"), { waitUntil: "domcontentloaded", timeout: 12_000 });
      assert(heads > 0);
      assert.equal(new URL(page.url()).searchParams.get("mode"), "chips");
      assert.equal(new URL(page.url()).hash, "#table");
      assert.equal(await page.locator("h1").textContent(), "Recovered");
    } else {
      await page.waitForFunction(() => window.bootstrapRan === true);
      await page.waitForTimeout(3_000);
      assert(heads > 0);
      assert.equal(new URL(page.url()).searchParams.has("__gtg_recovery"), false);
      assert.notEqual(await page.evaluate(() => document.readyState), "complete");
    }
    assert.deepEqual(errors, []);
    results.push({ engine, scenario, heads, passed: true });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
    for (const res of pending) res.destroy();
  }
} finally {
  await writeFile(new URL(`startup-${engine}.json`, output), JSON.stringify(results, null, 2));
  await browser.close();
  for (const res of pending) res.destroy();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
