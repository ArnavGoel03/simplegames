import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, webkit } from "playwright";
import catalogue from "../src/lib/game-catalogue.json" with { type: "json" };
import assert from "node:assert/strict";
import { candidates, instrument, networkVerdict, observeSource, omitServiceWorkerCapability, recordEvidence, startupMeasurement, timedClick, timedFragmentClick } from "./browser-evidence.mjs";

const output = new URL("../.audit/visual/", import.meta.url);
await mkdir(output, { recursive: true });
const live = process.argv.includes("--live");
const local = "http://127.0.0.1:3187";
const preview = process.env.CASINO_PREVIEW;
const engine = process.env.BROWSER_ENGINE || "chromium";
if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser engine");
const availableSites = candidates.length ? candidates.map(item => ({ id: item.site, url: item.origin })) : preview ? [{ id: "teenpatti", url: preview }] : live
  ? [{ id: "studio", url: "https://glasstablegames.com" }, ...catalogue.sites]
  : [{ id: "studio", url: local }];
const siteFilter = process.env.SITE_FILTER?.trim();
if (siteFilter && (siteFilter !== "studio" || process.env.BASELINE_ONLY !== "true" || !live || candidates.length)) {
  throw new Error("SITE_FILTER is only supported for the studio live baseline");
}
const sites = siteFilter ? availableSites.filter(site => site.id === siteFilter) : availableSites;
const sizes = [[320, 720], [390, 844], [844, 390], [1024, 768], [1440, 1000], [2560, 1440]];
const results = [];
const performanceResults = [];
let server;
let browser;
let activePage;
const traces = [];
const baseline = process.env.BASELINE_ONLY === "true";

async function verifyCasino(page, origin, colorScheme, probe) {
  await page.locator(".casino-feature-picker").waitFor();
  if (await page.locator(".casino-floor-game").count() !== 11) throw new Error("Casino must expose eleven games");
  // Transformed art below the viewport may be omitted by a full-page capture.
  // The unchanged scrolled viewport is the paint evidence for this card.
  await page.locator('.casino-floor-game[data-game="prize-wheel"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: new URL(`casino-${colorScheme}-wheel-visible.jpg`, output).pathname, fullPage: false, type: "jpeg", quality: 85 });
  for (const [name, slug] of [["Blackjack", "blackjack"], ["Slots", "slots"], ["Roulette", "roulette"]]) {
    await page.locator(".casino-feature-picker").getByRole("button", { name, exact: true }).click();
    if (await page.locator("#casino-feature-title").textContent() !== name || await page.locator(".casino-enter").getAttribute("href") !== `/casino/${slug}`) {
      throw new Error("Featured game and destination disagree");
    }
  }
  for (const button of await page.locator(".casino-floor-filters button").all()) {
    await button.click();
    if (await page.locator(".casino-floor-game").count() < 1) throw new Error("Empty Casino filter");
  }
  await page.locator(".casino-floor-filters").getByRole("button", { name: "Games", exact: true }).click();
  await page.locator(".casino-progress-details summary").click();
  if (await page.locator(".casino-progress-game").count() !== 11) throw new Error("Progress checklist must expose eleven games");
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.locator("#casino-feature-title").textContent() !== "Roulette") throw new Error("Resize reset selected game");
  await page.screenshot({ path: new URL(`casino-${colorScheme}-progress.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 80 });
  probe.mark("casino-link-enter");
  await page.locator(".casino-enter").click();
  await page.waitForURL(new URL("/casino/roulette", origin).href);
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.locator(".casino-proof").waitFor();
  probe.mark("casino-link-back");
  await page.locator('.casino-header a[href="/"]').click();
  await page.waitForURL(origin + "/");
  await page.locator(".casino-progress-details summary").click();
  const roulette = page.locator(".casino-progress-game").filter({ has: page.getByRole("link", { name: "Roulette", exact: true }) });
  await roulette.locator('[aria-label="Roulette: 1 / 1"]').waitFor();
  // This persistence assertion deliberately replaces the document. Let its
  // preceding Link transition finish before testing a user-initiated reload.
  await page.waitForLoadState("networkidle", { timeout: 10_000 });
  probe.mark("casino-persistence-reload");
  await page.reload({ waitUntil: "load" });
  await page.locator(".casino-progress-details summary").click();
  await roulette.locator('[aria-label="Roulette: 1 / 1"]').waitFor();
  probe.mark("casino-progress-link");
  await roulette.getByRole("link", { name: "Roulette", exact: true }).click();
  await page.waitForURL(new URL("/casino/roulette", origin).href);
  await page.locator('.casino-mode-tabs button').filter({ hasText: /^Chips$/ }).click();
  await page.locator('.casino-mode-tabs button[aria-pressed="true"]').filter({ hasText: /^Chips$/ }).waitFor({ timeout: 10_000 });
  if (await page.getByRole("button", { name: "Spin", exact: true }).isEnabled()) throw new Error("Signed-out Chips action must stay disabled");
  results.push({ name: `casino-${colorScheme}-interactions`, url: origin, overflow: false, images: [], errors: [], checks: ["featured destinations", "all filters", "eleven games", "resize state", "practice completion", "reload persistence", "Chips account boundary"] });
}

try {
  if (!live && !preview) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3187"], { stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Preview did not become ready in 30 seconds")), 30_000);
      const ready = (data) => {
        process.stdout.write(data);
        if (data.toString().includes("Ready in")) { clearTimeout(timeout); resolve(); }
      };
      server.stdout.on("data", ready);
      server.stderr.on("data", data => process.stderr.write(data));
      server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
      server.once("error", error => { clearTimeout(timeout); reject(error); });
    });
  }
  browser = await ({ chromium, webkit })[engine].launch();
  for (const site of sites) {
    const url = new URL(site.url);
    if (!(url.origin === local || (url.protocol === "https:" && (url.hostname === "glasstablegames.com" || url.hostname.endsWith(".glasstablegames.com") || ((preview || candidates.length) && url.hostname.endsWith(".goelhome.workers.dev")))))) {
      throw new Error(`Unexpected visual target: ${url.origin}`);
    }
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({ colorScheme, reducedMotion: "reduce", viewport: { width: sizes[0][0], height: sizes[0][1] } });
      const page = await context.newPage();
      activePage = page;
      page.setDefaultNavigationTimeout(20_000);
      const probe = await instrument(page);
      const { errors } = probe;
      traces.push({ site: site.id, colorScheme, ...probe });
      const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
      if (!response?.ok()) throw new Error(`${url.href}: HTTP ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(async () => {
        for (const image of document.images) image.loading = "eager";
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
      });
      const observedSourceHead = await observeSource(page, site.id);
      const layouts = [];
      // Calibrate the overflow detector against a known oversized element.
      const detectsOverflow = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.cssText = "position:absolute;left:0;top:0;width:200vw;height:1px";
        document.body.append(probe);
        const detected = document.documentElement.scrollWidth > innerWidth + 1;
        probe.remove();
        return detected;
      });
      if (!detectsOverflow) throw new Error("Overflow detector failed positive calibration");
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          images: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc),
          title: document.title,
          background: getComputedStyle(document.body).backgroundColor,
          heading: document.querySelector("h1")?.textContent,
          footerStampClipped: [...document.querySelectorAll('footer .build-stamp[title], footer .play-num[title]')].some(element => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
          }),
        }));
        const name = `${site.id}-${colorScheme}-${width}x${height}`;
        await page.screenshot({ path: new URL(`${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 80 });
        results.push({ name, url: url.href, ...state, errors: [...errors] });
        layouts.push(results.at(-1));
        console.log(JSON.stringify(results.at(-1)));
      }
      await recordEvidence(site.id, observedSourceHead, [{ id: "responsive", status:
        layouts.length === sizes.length && layouts.every(item => !item.overflow && !item.footerStampClipped && item.images.length === 0 && item.errors.length === 0) ? "passed" : "failed" }], [], url.origin);
      if (site.id === "studio" && !baseline) {
        const destinations = await page.locator("header nav a").evaluateAll(links => links.map(link => link.getAttribute("href")));
        assert(destinations.length > 0, "Studio has no primary navigation");
        for (const href of destinations) {
          const destination = new URL(href, url);
          assert.equal(destination.origin, url.origin, "Primary navigation leaves the studio");
          await page.locator(`header nav a[href="${href}"]`).click();
          await page.waitForURL(destination.href, { waitUntil: "domcontentloaded" });
          assert.equal(await observeSource(page, site.id), observedSourceHead);
          await page.locator('header a[href="/"]').first().click();
          await page.waitForURL(url.origin + "/", { waitUntil: "domcontentloaded" });
        }
        await recordEvidence(site.id, observedSourceHead, [{ id: "entry", status: "passed" }]);
        await page.emulateMedia({ contrast: "more" });
        await page.screenshot({ path: new URL(`studio-${colorScheme}-contrast.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 80 });
      }
      if (site.id === "teenpatti" && !baseline) {
        await verifyCasino(page, url.origin, colorScheme, probe);
        results.at(-1).errors = [...errors];
        await recordEvidence(site.id, observedSourceHead, [{ id: "entry", status: "passed" }]);
      }
      probe.mark("context-close-start");
      await context.close();
    }
    const samples = [];
    const interactions = [];
    let observedSourceHead;
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
      await context.addInitScript(omitServiceWorkerCapability);
      const page = await context.newPage();
      const probe = await instrument(page);
      traces.push({ site: site.id, sample, ...probe });
      page.setDefaultTimeout(10_000);
      try {
        const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
        assert(response?.ok(), "Startup navigation failed");
        observedSourceHead = await observeSource(page, site.id);
        const measurement = await startupMeasurement(page);
        assert(measurement.stylesReady && measurement.decodedCssBytes > 0 && measurement.decodedJsBytes > 0, "Startup did not load measurable CSS and JS");
        samples.push(measurement);
        // A real existing control; no synthetic click target is inserted.
        const selectors = ['.casino-feature-picker button:not([aria-pressed="true"])', '.play-entry-choices button:not([aria-pressed="true"])', 'summary', 'header a[href="/#games"]', 'header a[href="#games"]', 'header a[href="/"]'];
        let control;
        for (const selector of selectors) {
          const found = page.locator(selector).first();
          if (await found.isVisible()) { control = found; break; }
        }
        assert(control, "No safe existing interaction target found");
        interactions.push(await (site.id === "studio" ? timedFragmentClick(page, control) : timedClick(page, control)));
        assert.deepEqual(probe.errors, [], "Startup or interaction raised browser errors");
      } finally { probe.mark("context-close-start"); await context.close(); }
    }
    const interactionMetric = site.id === "studio" ? "games-navigation" : "interaction";
    performanceResults.push({ site: site.id, engine, observedSourceHead, samples, interactionMs: interactions, interactionMetric,
      definition: `startup: navigation to loaded styles/fonts and two animation frames; ${interactionMetric}: trusted existing-control click to ${site.id === "studio" ? "completed fragment scroll and two further stable frames" : "two animation frames"}; fresh browser context per sample` });
    await recordEvidence(site.id, observedSourceHead, [{ id: "startup", status: "passed" }], [
      { id: "startup", unit: "ms", samples: samples.map(item => item.startupMs) },
      { id: interactionMetric, unit: "ms", samples: interactions },
      { id: "initial-assets", unit: "bytes", samples: samples.map(item => item.decodedJsBytes + item.decodedCssBytes) },
    ], url.origin);
  }
  for (const measured of performanceResults) {
    const siteTraces = traces.filter(trace => trace.site === measured.site);
    const faulted = siteTraces.some(trace => !networkVerdict(trace).passed);
    await recordEvidence(measured.site, measured.observedSourceHead, [{ id: "network", status: faulted ? "failed" : "passed" }], [], new URL(sites.find(site => site.id === measured.site).url).origin);
  }
  if (!baseline && traces.some(trace => !networkVerdict(trace).passed)) {
    throw new Error("Candidate network checks found failed requests or runtime errors; inspect network-trace.json");
  }
  if (results.some(result => result.overflow || result.footerStampClipped || result.images.length || result.errors.length)) {
    throw new Error("Visual checks found overflow, failed images or runtime errors");
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: new URL("failure.jpg", output).pathname, fullPage: true, timeout: 5_000 }).catch(() => {});
    const state = await activePage.evaluate(() => ({
      url: location.origin + location.pathname, ready: document.readyState,
      title: document.title, body: document.body?.innerText.slice(0, 1000),
      styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(el => ({ path: new URL(el.href).pathname, loaded: Boolean(el.sheet) })),
    })).catch(() => null);
    await writeFile(new URL("failure.json", output), JSON.stringify({ engine, error: String(error), state }, null, 2));
  }
  throw error;
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify(results, null, 2));
  await writeFile(new URL("performance.json", output), JSON.stringify(performanceResults, null, 2));
  await writeFile(new URL("network-trace.json", output), JSON.stringify(traces.map(probe => ({ ...probe, verdict: networkVerdict(probe) })), null, 2));
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolve => {
      const timeout = setTimeout(() => { server.kill("SIGKILL"); resolve(); }, 5_000);
      server.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
  }
}
