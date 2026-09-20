import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, observeSource, output } from "./browser-evidence.mjs";

const directory = new URL("./fixtures/player-history/", import.meta.url);
const manifestPath = new URL("manifest.json", directory);
if (!existsSync(manifestPath)) {
  console.log("No synthetic player-history fixture supplied");
  process.exit(0);
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const candidate = candidates.find(item => item.site === "board");
assert(candidate, "Player history requires a certified board candidate");
assert.equal(manifest.schema, 1);
assert.equal(manifest.synthetic, true);
assert.equal(manifest.sourceHead, candidate.sourceHead, "Fixture source differs from candidate");
assert.equal(manifest.sourceFingerprint, candidate.sourceFingerprint, "Fixture tree differs from candidate");
assert.deepEqual(manifest.fixtures.map(item => item.name), ["history", "comparison", "empty", "account", "account-switching"]);
await mkdir(output, { recursive: true });
const results = [];
const browser = await ({ chromium, webkit })[engine].launch();
try {
  for (const colorScheme of ["dark", "light"]) {
    const context = await browser.newContext({ colorScheme, reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(20_000);
    const response = await page.goto(new URL("/account", candidate.origin).href, { waitUntil: "domcontentloaded" });
    assert(response?.ok(), "Candidate account stylesheet source failed");
    await observeSource(page, "board");
    const shell = await page.evaluate(() => ({
      htmlClass: document.documentElement.className,
      styles: [...document.head.querySelectorAll('style, link[rel="stylesheet"]')].map(element => element.outerHTML).join(""),
    }));
    assert(shell.styles.includes("stylesheet"), "Candidate must supply actual built stylesheets");
    await page.close();
    for (const fixture of manifest.fixtures) {
      const markup = await readFile(new URL(`${fixture.name}.html`, directory), "utf8");
      assert.equal(createHash("sha256").update(markup).digest("hex"), fixture.sha256, "Fixture content changed");
      assert(!/<script\b/i.test(markup), "Static fixture must not contain scripts");
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      page.setDefaultTimeout(15_000);
      const fixtureUrl = new URL(`/__player_history_fixture__/${fixture.name}`, candidate.origin).href;
      await page.route(fixtureUrl, route => route.fulfill({ contentType: "text/html",
        body: `<!doctype html><html lang="en" class="${shell.htmlClass}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${candidate.origin}/">${shell.styles}</head><body><main class="mx-auto max-w-3xl p-4">${markup}</main></body></html>`,
      }));
      await page.goto(fixtureUrl, { waitUntil: "load", timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => {
        const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
        return stylesheets.length > 0 && stylesheets.every(link => link.sheet && new URL(link.href).origin === location.origin);
      }), "Every candidate stylesheet must load from the immutable origin");
      assert.equal(await page.locator("main li").count(), fixture.rows);
      assert.equal(await page.locator('a[rel="next"]').count(), fixture.next ? 1 : 0);
      if (fixture.next) assert.equal(await page.locator('a[rel="next"]').getAttribute("href"), fixture.next);
      if (fixture.name === "account") assert.equal(await page.getByRole("link", { name: "Your record", exact: true }).getAttribute("href"), "/player/fixture-rook");
      if (fixture.name === "account-switching") {
        assert.equal(await page.locator('[aria-busy="true"]').count(), 1);
        assert.equal(await page.getByRole("link", { name: "Your record", exact: true }).count(), 0);
        assert(!(await page.locator("main").innerText()).includes("Fixture Rook"));
      }
      if (fixture.name === "comparison") {
        assert.equal(await page.getByRole("link", { name: "Rummy", exact: true }).getAttribute("aria-current"), "page");
        assert.equal(await page.getByRole("link", { name: "Between you two", exact: true }).getAttribute("href"), "/player/fixture-rook?game=rummy#games");
      }
      for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const calibrated = await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.style.cssText = "position:absolute;left:0;width:200vw;height:1px";
          document.body.append(probe);
          const found = document.documentElement.scrollWidth > innerWidth + 1;
          probe.remove();
          return found;
        });
        assert(calibrated, "Overflow detector missed positive control");
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          clippedControls: [...document.querySelectorAll("main a, main button")].filter(element => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
          }).length,
        }));
        const name = `history-${fixture.name}-${colorScheme}-${width}x${height}`;
        await page.screenshot({ path: new URL(`${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
        results.push({ name, ...state, fixtureSha256: fixture.sha256 });
        assert.equal(state.overflow, false, name);
        assert.equal(state.clippedControls, 0, name);
      }
      await page.close();
    }
    assert.deepEqual(errors, [], "Candidate or fixture emitted browser errors");
    await context.close();
  }
} finally {
  await writeFile(new URL(`player-history-${engine}.json`, output), JSON.stringify({
    candidate, fixtureSource: manifest.sourceHead, rendering: manifest.rendering, results,
  }, null, 2));
  await browser.close();
}
console.log(`Verified ${results.length} synthetic player-history layouts`);
