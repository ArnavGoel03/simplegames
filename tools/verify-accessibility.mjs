import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, observeSource, omitServiceWorkerCapability, output, recordEvidence } from "./browser-evidence.mjs";
import { accessibilitySites, verifyFixture } from "./accessibility-fixture.mjs";

const directory = new URL("./fixtures/accessibility/", import.meta.url);
const supported = candidates.filter(candidate => accessibilitySites[candidate.site]);
if (!supported.length) { console.log("No migrated accessibility candidate supplied"); process.exit(0); }
assert(existsSync(new URL("manifest.json", directory)), "Migrated accessibility candidates require canonical fixtures");
const manifests = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
const bytes = await readFile(new URL("bundle.js", directory));
await mkdir(output, { recursive: true });
const results = [];
const diagnostics = [];
const browser = await ({ chromium, webkit })[engine].launch();
function fakeSpeech() {
  const speech = { utterances: [], current: null, cancels: 0,
    speak(utterance) { this.utterances.push(utterance); this.current = utterance; },
    cancel() { this.cancels++; this.current = null; } };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: speech });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class { constructor(text) { this.text = text; } } });
}
try {
  for (const candidate of supported) {
    const manifest = manifests.find(item => item.site === candidate.site);
    assert(manifest, `Missing accessibility fixture: ${candidate.site}`);
    verifyFixture(manifest, candidate, bytes);
    for (const colorScheme of ["dark", "light"]) {
      const context = await browser.newContext({ colorScheme, reducedMotion: "reduce", serviceWorkers: "block" });
      await context.addInitScript(omitServiceWorkerCapability);
      await context.addInitScript(fakeSpeech);
      const errors = [];
      const diagnostic = { site: candidate.site, colorScheme, errors, requests: [] };
      diagnostics.push(diagnostic);
      context.on("page", page => {
        page.on("pageerror", error => { errors.push(error.message); console.error(`Accessibility ${candidate.site} browser error: ${error.message}`); });
        page.on("requestfailed", request => diagnostic.requests.push({ url: request.url(), failure: request.failure()?.errorText }));
        page.on("response", response => { if (response.url().includes("/__accessibility_fixture__/") || response.status() >= 400) diagnostic.requests.push({ url: response.url(), status: response.status(), contentType: response.headers()["content-type"] }); });
        page.on("console", message => { if (message.type() === "error") { const entry = `Console: ${message.text()}`; errors.push(entry); console.error(entry); } });
      });
      const shellPage = await context.newPage();
      shellPage.setDefaultTimeout(15_000);
      const response = await shellPage.goto(candidate.origin, { waitUntil: "domcontentloaded", timeout: 20_000 });
      assert(response?.ok(), "Candidate stylesheet source failed");
      await observeSource(shellPage, candidate.site);
      const shell = await shellPage.evaluate(() => ({ htmlClass: document.documentElement.className,
        styles: [...document.head.querySelectorAll('style, link[rel="stylesheet"]')].map(element => element.outerHTML).join("") }));
      assert(shell.styles.includes("stylesheet"), "Candidate must supply actual built stylesheets");
      await shellPage.close();
      await context.route(new URL("/__accessibility_fixture__/bundle.js", candidate.origin).href,
        route => route.fulfill({ contentType: "text/javascript", body: bytes }));
      await context.route(new URL("/__accessibility_fixture__/**", candidate.origin).href, route => {
        if (new URL(route.request().url()).pathname.endsWith("/bundle.js")) return route.fallback();
        return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="en" class="${shell.htmlClass}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${candidate.origin}/">${shell.styles}</head><body><div id="fixture-root"></div><script src="/__accessibility_fixture__/bundle.js"></script></body></html>` });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const open = async surface => {
        await page.goto(new URL(`/__accessibility_fixture__/?surface=${surface}`, candidate.origin).href, { waitUntil: "load", timeout: 20_000 });
        try { await page.waitForFunction(() => Boolean(window.fixture)); }
        catch (error) {
          console.error(`Accessibility fixture initialization failed: ${JSON.stringify(diagnostic)}`);
          await page.screenshot({ path: new URL(`accessibility-failed-${candidate.site}-${colorScheme}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
          throw error;
        }
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet && new URL(link.href).origin === location.origin)), "Candidate styles failed to load");
      };
      const surfaces = candidate.site === "words" ? ["blank"] : candidate.site === "cards" ? ["round", "deal", "score", "showdown"] : [];
      for (const surface of surfaces) {
        await open(surface);
        const trigger = page.locator("#fixture-trigger");
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog");
        await dialog.waitFor({ state: "visible" });
        assert.equal(await dialog.getAttribute("aria-modal"), "true");
        assert(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)), "Initial focus escaped native dialog");
        assert(await dialog.getAttribute("aria-labelledby"), "Dialog needs a heading reference");
        const buttons = await dialog.getByRole("button").count();
        assert(buttons > 0);
        for (let i = 0; i <= buttons; i++) {
          await page.keyboard.press("Tab");
          assert(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)), `Tab escaped ${surface}`);
        }
        await page.keyboard.press("Shift+Tab");
        assert(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)), `Reverse Tab escaped ${surface}`);
        // Scripted focus is the adversarial positive control for browser inertness.
        assert.equal(await page.evaluate(() => { document.querySelector("#fixture-background-action").focus(); return document.activeElement.id === "fixture-background-action"; }), false, "Background accepted focus while modal");
        for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) {
          await page.setViewportSize({ width, height });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const state = await dialog.evaluate(element => {
            const controls = [...element.querySelectorAll("button")].map(button => { const box = button.getBoundingClientRect(); return { text: button.textContent, width: box.width, height: box.height, clipped: box.left < -1 || box.right > innerWidth + 1 }; });
            const probe = document.createElement("button"); probe.style.cssText = "position:fixed;left:200vw;width:40px;height:40px"; element.append(probe);
            const detected = probe.getBoundingClientRect().right > innerWidth; probe.remove();
            return { controls, calibrated: detected, width: element.getBoundingClientRect().width };
          });
          assert(state.calibrated && state.controls.every(control => control.width > 0 && control.height > 0 && !control.clipped), `Clipped modal controls: ${surface}`);
          const name = `accessibility-${candidate.site}-${surface}-${colorScheme}-${width}x${height}`;
          await page.screenshot({ path: new URL(`${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
          results.push({ name, ...state });
        }
        if (surface === "showdown") {
          await page.emulateMedia({ reducedMotion: "no-preference" });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached" });
          await trigger.press("Enter");
          await page.getByRole("button", { name: "Show all", exact: true }).waitFor();
          await page.keyboard.press("Escape");
          await page.getByRole("button", { name: "Next hand, first to 25", exact: true }).waitFor();
          assert(await dialog.evaluate(element => element.contains(document.activeElement)), "Showdown reveal lost action focus");
        }
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        assert.equal(await trigger.evaluate(element => document.activeElement === element), true, "Dismissal did not restore trigger focus");
        if (surface === "blank") {
          await trigger.press("Enter");
          await page.getByRole("button", { name: "A", exact: true }).press("Enter");
          assert.equal(await page.evaluate(() => window.fixture.picked), "A");
          await dialog.waitFor({ state: "detached" });
        }
      }
      if (candidate.site === "draw") {
        await open("drawing");
        const canvas = page.locator("canvas");
        assert.equal(await canvas.getAttribute("tabindex"), "0");
        await canvas.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Shift+ArrowRight"); await page.keyboard.press("Space");
        const ink = await page.evaluate(() => window.fixture.strokes);
        assert(ink.some(stroke => stroke.tool === "pen" && stroke.points.some(point => Math.abs(point.x - .55) < 1e-8)), "Keyboard pen never reached canonical stroke callback");
        const count = ink.length;
        await page.keyboard.press("ArrowDown"); await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => window.fixture.strokes.length), count, "Lifted keyboard pen kept drawing");
        await page.evaluate(() => window.fixture.setBrush("rect"));
        await page.waitForTimeout(0); await page.keyboard.press("Enter"); await page.keyboard.press("Shift+ArrowRight"); await page.keyboard.press("Shift+ArrowDown"); await page.keyboard.press("Enter");
        const rectangle = await page.evaluate(() => window.fixture.strokes.at(-1));
        assert(rectangle.points.length === 5 && rectangle.points[0].x === rectangle.points[4].x && rectangle.points[0].y === rectangle.points[4].y && new Set(rectangle.points.map(point => point.x)).size === 2 && new Set(rectangle.points.map(point => point.y)).size === 2, "Keyboard rectangle did not close with width and height");
        await page.evaluate(() => window.fixture.setMode("mark"));
        await page.waitForTimeout(0); await canvas.focus(); await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => window.fixture.marks.length), 1);
        for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) {
          await page.setViewportSize({ width, height });
          await page.screenshot({ path: new URL(`accessibility-draw-${colorScheme}-${width}x${height}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
        }
      }
      await open("reading");
      const read = page.locator("[data-read-aloud-control] button");
      await page.evaluate(() => { document.querySelector("#fixture-reading").style.marginTop = "150vh"; });
      await read.focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-read-aloud-control] button").getAttribute("aria-pressed") === "true");
      assert.equal(await page.evaluate(() => speechSynthesis.current.text), "First visible sentence. Second sentence.");
      await page.evaluate(() => { speechSynthesis.current.onstart?.({}); speechSynthesis.current.onboundary?.({ charIndex: 6 }); });
      assert(await page.evaluate(() => scrollY > 0), "Read aloud did not follow the spoken passage");
      const highlight = await page.evaluate(() => {
        if (CSS.highlights) return { sentence: [...CSS.highlights.get("play-reading-sentence")][0].toString(), word: [...CSS.highlights.get("play-reading-word")][0].toString() };
        return { overlays: document.querySelectorAll(".play-reading-overlay").length };
      });
      assert(highlight.overlays > 0 || highlight.word === "visible", "Speech boundary did not highlight spoken word");
      if (!highlight.overlays) assert.equal(highlight.sentence.trim(), "First visible sentence.");
      await page.evaluate(() => speechSynthesis.current.onend?.({}));
      assert.equal(await page.evaluate(() => speechSynthesis.current.text), "Final passage.");
      const saved = await page.evaluate(() => { window.fixture.late = speechSynthesis.current; return speechSynthesis.cancels; });
      await page.screenshot({ path: new URL(`accessibility-reading-${candidate.site}-${colorScheme}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
      await page.locator("#fixture-navigation").click();
      assert.equal(await read.getAttribute("aria-pressed"), "false");
      assert(await page.evaluate(previous => speechSynthesis.cancels > previous, saved));
      await page.evaluate(() => window.fixture.late.onboundary?.({ charIndex: 0 }));
      assert.equal(await page.evaluate(() => (CSS.highlights?.has("play-reading-word") || false) || document.querySelectorAll(".play-reading-overlay").length > 0), false, "Late speech event restored cancelled highlight");
      await read.press("Enter"); await page.keyboard.press("Escape");
      assert.equal(await read.getAttribute("aria-pressed"), "false");
      await read.press("Enter"); await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
      assert.equal(await read.getAttribute("aria-pressed"), "false");
      await read.press("Enter"); await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      assert.equal(await read.getAttribute("aria-pressed"), "false");
      await read.press("Enter"); await page.evaluate(() => window.fixture.unmount());
      assert.equal(await page.evaluate(() => speechSynthesis.current), null);
      assert.deepEqual(errors, [], "Canonical fixture emitted browser errors");
      await context.close();
    }
    await recordEvidence(candidate.site, candidate.sourceHead, [{ id: "accessibility", status: "passed", details: "Canonical migrated surfaces, native focus lifecycle, keyboard drawing, synthetic speech boundary and navigation cancellation" }], [], candidate.origin);
  }
} finally {
  await writeFile(new URL(`accessibility-${engine}.json`, output), JSON.stringify({ candidates: supported, synthetic: true, speech: "Deterministic injected speech, no installed voice required", diagnostics, results }, null, 2));
  await browser.close();
}
console.log(`Verified ${results.length} canonical accessibility layouts`);
