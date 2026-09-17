import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, instrument, observePerformanceTiming, omitServiceWorkerCapability, output, startupMeasurement, timedFragmentClick } from "./browser-evidence.mjs";

// Diagnostic comparison only. No release evidence or performance policy changes.
const candidate = candidates.find(item => item.site === "studio");
const targets = candidate ? [
  { id: "live", origin: "https://glasstablegames.com" },
  { id: "candidate", origin: candidate.origin, sourceHead: candidate.sourceHead },
] : [];
const report = { schema: 1, purpose: "same-run studio performance comparison", engine, candidate,
  definition: "Three alternating samples per target and instrumentation mode; canonical startupMeasurement and completed Games fragment scroll plus two stable frames; 390x844, reduced motion, service-worker capability omitted as in the release harness, fresh context",
  modes: { full: "Current release network/stream and timing instrumentation", timing: "Same ready/click/two-frame timing, without fetch/stream wrappers or browser bindings" },
  samples: [] };
let browser;
let deadline;

// Local-only observations are identical in both modes. No protocol calls or
// geometry reads happen during the measured click and its animation frames.
function diagnosticTiming() {
  const data = window.gtgPerformanceProbe = {
    supportedEntries: [...PerformanceObserver.supportedEntryTypes], clicks: [], longTasks: [], events: [],
  };
  if (data.supportedEntries.includes("longtask")) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (data.longTasks.length < 100) {
        data.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
      }
    }).observe({ type: "longtask", buffered: true });
  }
  for (const name of ["DOMContentLoaded", "load", "gtg:app-ready", "hashchange", "scroll"]) {
    window.addEventListener(name, () => {
      if (data.events.length < 100) data.events.push({ name, at: performance.now(), scrollY });
    }, { passive: true });
  }
  window.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("a, button, summary") : null;
    const click = { at: performance.now(), eventTimeStamp: event.timeStamp, trusted: event.isTrusted,
      target: target ? { tag: target.tagName, text: target.textContent.trim().slice(0, 80), href: target.getAttribute("href") } : null,
      initialScrollY: scrollY, frames: [] };
    data.clicks.push(click);
    const frame = timestamp => {
      click.frames.push({ timestamp, at: performance.now(), scrollY });
      if (click.frames.length < 8) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, true);
  window.addEventListener("click", event => {
    const click = data.clicks.at(-1);
    if (click) { click.bubbledAt = performance.now(); click.defaultPrevented = event.defaultPrevented; }
  });
}

async function frames(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const samples = [];
    const timeout = setTimeout(() => reject(new Error("Frame calibration exceeded three seconds")), 3000);
    const frame = timestamp => {
      samples.push({ timestamp, at: performance.now() });
      if (samples.length < 8) requestAnimationFrame(frame);
      else { clearTimeout(timeout); resolve(samples); }
    };
    requestAnimationFrame(frame);
  }));
}

async function sourceOnPage(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".build-stamp[title], .play-num[title]")]
    .some(element => /^[a-f0-9]{40}$/i.test(element.getAttribute("title") ?? "") && element.getBoundingClientRect().width > 0));
  const values = await page.locator(".build-stamp[title], .play-num[title]").evaluateAll(elements =>
    [...new Set(elements.map(element => element.getAttribute("title")).filter(value => /^[a-f0-9]{40}$/i.test(value ?? "")))]);
  assert.equal(values.length, 1, "Page must expose one full source revision");
  return values[0];
}

async function trial(target, mode, sample) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
  await context.addInitScript(omitServiceWorkerCapability);
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const result = { target: target.id, origin: target.origin, mode, sample, errors: [], diagnosticRequests: 0 };
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/diagnostics") result.diagnosticRequests++; });
  report.samples.push(result);
  let probe;
  try {
    result.blankFrames = await frames(page);
    if (mode === "full") probe = await instrument(page);
    else await page.addInitScript(observePerformanceTiming);
    await page.addInitScript(diagnosticTiming);
    page.on("pageerror", error => result.errors.push(error.message));
    const response = await page.goto(target.origin, { waitUntil: "domcontentloaded", timeout: 20_000 });
    assert(response?.ok(), "Performance document failed");
    assert.equal(new URL(page.url()).origin, target.origin, "Performance navigation changed origin");
    result.sourceHead = await sourceOnPage(page);
    if (target.sourceHead) assert.equal(result.sourceHead, target.sourceHead, "Candidate source changed");
    result.startup = await startupMeasurement(page);
    assert(result.startup.stylesReady && result.startup.decodedCssBytes > 0 && result.startup.decodedJsBytes > 0, "Startup lacks loaded CSS/JS");
    // Match the release selector order and record which existing control won.
    const selectors = ['.casino-feature-picker button:not([aria-pressed="true"])', '.play-entry-choices button:not([aria-pressed="true"])', 'summary', 'header a[href="/#games"]', 'header a[href="#games"]', 'header a[href="/"]'];
    let control;
    for (const selector of selectors) {
      const found = page.locator(selector).first();
      if (await found.isVisible()) { control = found; result.selector = selector; break; }
    }
    assert(control, "No existing interaction control found");
    result.gamesNavigationMs = await timedFragmentClick(page, control);
    result.earlyInteractionMs = await page.evaluate(() => window.gtgPerformance.interactions[0]);
    await page.waitForFunction(() => window.gtgPerformanceProbe.clicks.at(-1)?.frames.length === 8);
    result.afterClickFrames = await frames(page);
    result.page = await page.evaluate(() => {
      const pickTiming = entry => Object.fromEntries([
        "startTime", "duration", "redirectStart", "redirectEnd", "fetchStart", "domainLookupStart", "domainLookupEnd",
        "connectStart", "secureConnectionStart", "connectEnd", "requestStart", "responseStart", "responseEnd",
        "domInteractive", "domContentLoadedEventStart", "domContentLoadedEventEnd", "loadEventStart", "loadEventEnd",
        "transferSize", "encodedBodySize", "decodedBodySize", "nextHopProtocol", "responseStatus",
      ].filter(key => key in entry).map(key => [key, entry[key]]));
      const anchor = document.querySelector("#games");
      return { ...window.gtgPerformanceProbe, fragmentNavigation: window.gtgFragmentNavigation, visibility: document.visibilityState, hash: location.hash,
        galleryTop: anchor?.getBoundingClientRect().top, scrollY,
        navigation: pickTiming(performance.getEntriesByType("navigation")[0]),
        resources: performance.getEntriesByType("resource").slice(0, 250).map(entry => {
          const url = new URL(entry.name);
          return { path: url.pathname, sameOrigin: url.origin === location.origin, initiatorType: entry.initiatorType,
            rsc: url.searchParams.has("_rsc"), ...pickTiming(entry) };
        }),
      };
    });
    assert.equal(result.page.clicks.length, 1, "Probe did not observe exactly one click");
    assert(result.page.clicks[0].trusted, "Probe click was not trusted");
    if (result.page.clicks[0].target?.href?.endsWith("#games")) {
      assert.equal(result.page.hash, "#games", "Games click did not navigate to the fragment");
      assert(Math.abs(result.page.galleryTop) < 200, "Games click did not scroll to its target");
    }
    assert.equal(await page.evaluate(() => "serviceWorker" in navigator), false, "Performance context retains a blocked registration shim");
    assert.equal(result.diagnosticRequests, 0, "Performance control generated diagnostic traffic");
    result.completed = true;
  } catch (error) {
    result.failure = String(error.stack ?? error);
    process.exitCode = 1;
  } finally {
    if (probe) {
      result.network = { counts: probe.counts, failed: probe.failed, trace: probe.trace };
      probe.mark("context-close-start");
    }
    await context.close();
    await writeFile(new URL(`performance-probe-${engine}.json`, output), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ target: result.target, mode, sample, source: result.sourceHead,
      startupMs: result.startup?.startupMs, appReadyMs: result.startup?.appReadyMs, domReadyMs: result.startup?.domReadyMs,
      navigation: result.page?.navigation, diagnosticRequests: result.diagnosticRequests,
      startupResources: result.page?.resources.filter(entry => entry.responseEnd <= result.startup.startupMs).sort((a, b) => (b.responseEnd ?? 0) - (a.responseEnd ?? 0)).slice(0, 5),
      blankFrameGaps: result.blankFrames?.slice(1).map((frame, index) => frame.timestamp - result.blankFrames[index].timestamp),
      gamesNavigationMs: result.gamesNavigationMs, earlyInteractionMs: result.earlyInteractionMs,
      selector: result.selector, failure: result.failure }));
  }
}

if (!candidate) console.log("performance probe: skipped, no studio candidate supplied");
else {
  await mkdir(output, { recursive: true });
  try {
    browser = await ({ chromium, webkit })[engine].launch({ timeout: 15_000 });
    deadline = setTimeout(() => { report.failure = "Performance probe exceeded 180 seconds"; void browser.close(); }, 180_000);
    for (let sample = 0; sample < 3; sample++) {
      for (const [index, mode] of ["full", "timing"].entries()) {
        const order = (sample + index) % 2 ? [...targets].reverse() : targets;
        for (const target of order) {
          if (report.failure) throw new Error(report.failure);
          await trial(target, mode, sample);
        }
      }
    }
    report.completed = report.samples.length === 12 && report.samples.every(sample => sample.completed);
  } catch (error) { report.failure ??= String(error.stack ?? error); process.exitCode = 1; }
  finally {
    clearTimeout(deadline);
    await browser?.close();
    await writeFile(new URL(`performance-probe-${engine}.json`, output), JSON.stringify(report, null, 2));
  }
}
