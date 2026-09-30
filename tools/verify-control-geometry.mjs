import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, observeSource, omitServiceWorkerCapability, output, recordEvidence } from "./browser-evidence.mjs";
import { geometryFailures, measureControlGeometry } from "./control-geometry.mjs";

if (!candidates.length) { console.log("No control geometry candidates supplied"); process.exit(0); }
await mkdir(output, { recursive: true });
const results = [];
const browser = await ({ chromium, webkit })[engine].launch();
try {
  for (const candidate of candidates) {
    const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
    await context.addInitScript(omitServiceWorkerCapability);
    const page = await context.newPage(); page.setDefaultTimeout(15_000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    for (const colorScheme of ["dark", "light"]) {
      await page.emulateMedia({ colorScheme });
      await page.goto(candidate.origin, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await observeSource(page, candidate.site);
      await page.evaluate(() => document.fonts.ready);
      const choices = page.locator(".play-entry-choices button");
      const intents = await choices.count();
      for (let intent = -1; intent < intents; intent++) {
        if (intent >= 0) await choices.nth(intent).click();
        for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) {
          await page.setViewportSize({ width, height });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const measured = await page.evaluate(measureControlGeometry);
          assert(measured.groups.length, `No measured controls: ${candidate.site}`);
          const failures = geometryFailures(measured.groups, measured.expectedHeight);
          // Calibrate the exact detector against a deliberately undersized
          // button in an actual checked action row, then restore its CSS.
          const calibrated = await page.evaluate(async () => {
            const control = [...document.querySelectorAll(".play-room-actions button,.play-room-join button,.play-entry-choices button,.casino-feature-picker button,[data-read-aloud-control] button,.button--large")].find(element => {
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden" && !element.closest("li.play-seat");
            });
            if (!control) return false;
            const saved = control.getAttribute("style");
            control.style.setProperty("height", "16px", "important"); control.style.setProperty("min-height", "16px", "important");
            control.style.setProperty("max-height", "16px", "important"); control.style.setProperty("padding-block", "0", "important");
            control.style.setProperty("box-sizing", "border-box", "important");
            control.style.setProperty("appearance", "none", "important");
            control.style.setProperty("-webkit-appearance", "none", "important");
            window.controlGeometryCalibration = { control, saved };
            // Observe rendered geometry after WebKit commits the appearance change.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const style = getComputedStyle(control);
            return { text: control.textContent?.trim(), height: control.getBoundingClientRect().height,
              computed: Object.fromEntries(["height", "min-height", "max-height", "block-size", "min-block-size", "max-block-size", "appearance", "-webkit-appearance", "transform", "display", "box-sizing"].map(property => [property, style.getPropertyValue(property)])),
              inline: Object.fromEntries(["height", "min-height", "max-height", "appearance", "-webkit-appearance"].map(property => [property, { value: control.style.getPropertyValue(property), priority: control.style.getPropertyPriority(property) }])) };
          });
          assert(calibrated, "Missing positive geometry control");
          assert(calibrated.height <= 17, `Positive geometry control did not shrink: ${candidate.site}, intent${intent}, ${width}x${height}, ${JSON.stringify(calibrated)}`);
          const positive = await page.evaluate(measureControlGeometry);
          assert(geometryFailures(positive.groups, positive.expectedHeight).length > 0, "Geometry detector missed undersized real control");
          await page.evaluate(() => { const { control, saved } = window.controlGeometryCalibration; if (saved === null) control.removeAttribute("style"); else control.setAttribute("style", saved); delete window.controlGeometryCalibration; });
          const name = `geometry-${candidate.site}-${colorScheme}-intent${intent}-${width}x${height}`;
          results.push({ name, ...measured, failures });
          const region = await page.locator(".play-room-entry,.play-entry,.casino-arrival").count() ? page.locator(".play-room-entry,.play-entry,.casino-arrival").first() : page.locator("main").first();
          await region.screenshot({ path: new URL(`${name}.jpg`, output).pathname, type: "jpeg", quality: 85 });
          assert.deepEqual(failures, [], `Unequal or clipped controls: ${name}`);
          const hover = page.locator(".play-room-actions button,.play-room-join button,.play-entry-panel:not([hidden]) .play-btn,.casino-enter,.button--large").first();
          if (await hover.isVisible()) { await hover.hover(); const hovered = await page.evaluate(measureControlGeometry); assert.deepEqual(geometryFailures(hovered.groups, hovered.expectedHeight), [], `Hover changed control geometry: ${name}`); await region.screenshot({ path: new URL(`${name}-hover.jpg`, output).pathname, type: "jpeg", quality: 85 }); await page.mouse.move(0, 0); }
        }
      }
    }
    assert.deepEqual(errors, [], "Geometry candidate emitted browser errors");
    await recordEvidence(candidate.site, candidate.sourceHead, [{ id: "control-geometry", status: "passed" }], [], candidate.origin);
    await context.close();
  }
} finally { await writeFile(new URL(`control-geometry-${engine}.json`, output), JSON.stringify({ results }, null, 2)); await browser.close(); }
console.log(`Verified ${results.length} actual control layouts`);
