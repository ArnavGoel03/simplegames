import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import catalogue from "../src/lib/game-catalogue.json" with { type: "json" };
import { candidates, engine, observeSource, output } from "./browser-evidence.mjs";

const calibration = process.env.BASELINE_ONLY === "true";
assert(calibration || candidates.length, "Controls verification requires candidates or explicit live calibration");
const target = candidates.find(item => item.site === "teenpatti") ?? (calibration
  ? { site: "teenpatti", origin: new URL(catalogue.sites.find(item => item.id === "teenpatti").url).origin } : null);
assert(target, "Casino candidate missing");
const frames = [[320, 720], [844, 390], [1440, 1000]];
const results = [];
const observations = [];
const focusEvents = [];
const nativeTabControl = [];
const readinessFailures = [];
await mkdir(output, { recursive: true });
const browser = await ({ chromium, webkit })[engine].launch({ timeout: 20_000 });
const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 320, height: 720 } });
const writes = [];
await context.route("**/api/**", route => {
  if (["GET", "HEAD"].includes(route.request().method())) return route.continue();
  writes.push({ path: new URL(route.request().url()).pathname, method: route.request().method() });
  return route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(7_000);
page.setDefaultNavigationTimeout(15_000);
const errors = [];
const network = [];
page.on("pageerror", error => errors.push(error.message));
page.on("requestfailed", request => network.push({ kind: "failed", path: new URL(request.url()).pathname,
  method: request.method(), error: request.failure()?.errorText }));
page.on("response", response => { if (response.status() >= 400) network.push({ kind: "response", path: new URL(response.url()).pathname, status: response.status() }); });
async function focusState(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const modal = document.querySelector("dialog:modal");
    return { activeTag: active?.tagName, activeRole: active?.getAttribute("role"),
      documentFocused: document.hasFocus(), withinDialog: Boolean(modal?.contains(active)),
      withinSheet: Boolean(active?.closest(".play-sheet")), modal: Boolean(modal) };
  });
}
async function check(id, action) {
  try { await action(); results.push({ id, status: "passed" }); }
  catch (error) { results.push({ id, status: "failed", error: String(error.message).slice(0, 1200) }); }
  console.log(JSON.stringify(results.at(-1)));
}
async function open(game) {
  const response = await page.goto(`${target.origin}/casino/${game}?mode=practice`, { waitUntil: "domcontentloaded" });
  assert(response?.ok());
  try { await page.waitForFunction(() => window["gtg:app-ready"] === true, undefined, { timeout: 15_000 }); }
  catch (error) {
    readinessFailures.push({ game, url: page.url(), ...await page.evaluate(() => ({ readyState: document.readyState,
      ready: window["gtg:app-ready"] === true, visibility: document.visibilityState,
      scripts: [...document.scripts].filter(script => script.src).map(script => new URL(script.src).pathname),
      styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ path: new URL(link.href).pathname, loaded: Boolean(link.sheet) })) })) });
    await capture(`readiness-failure-${game}`);
    throw error;
  }
  const sourceHead = await observeSource(page, target.site);
  observations.push({ game, sourceHead, origin: new URL(page.url()).origin });
}
async function capture(name, fullPage = true) {
  await page.screenshot({ path: new URL(`controls-${engine}-${name}.jpg`, output).pathname, fullPage, type: "jpeg", quality: 80 });
}
async function resize(width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  // Calibrate native browser chrome traversal separately from application UI.
  const control = await context.newPage();
  await control.setContent('<button id="outside">Outside</button><dialog><button>Close</button><textarea></textarea><button>Send</button></dialog>');
  await control.evaluate(() => { document.querySelector("dialog").showModal(); document.querySelector("textarea").focus(); });
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await control.keyboard.press(key);
    const state = await focusState(control);
    if (!state.withinDialog) {
      await control.keyboard.press(key);
      state.nextInside = (await focusState(control)).withinDialog;
    }
    nativeTabControl.push({ key, ...state });
  }
  await control.close();
  await check("report-setup", () => open("blackjack"));
  const trigger = page.getByRole("button", { name: "Report a problem", exact: true });
  const sheet = page.locator(".play-sheet").filter({ has: page.locator("textarea") });
  const field = sheet.locator("textarea");
  const draft = "keyboard focus regression";
  await trigger.focus();
  await trigger.press("Enter");
  await sheet.waitFor();
  await check("report-initial-focus", async () => {
    assert(await sheet.locator('.play-sheet-bar button').evaluate(button => button === document.activeElement));
  });
  await check("report-native-modal", async () => { assert.equal(await page.locator("dialog:modal").count(), 1); });
  await check("report-typing-focus", async () => {
    await field.focus();
    for (const letter of draft) {
      await page.keyboard.type(letter);
      assert(await field.evaluate(element => element === document.activeElement), "Typing moved focus away from the report textarea");
    }
    assert.equal(await field.inputValue(), draft);
  });
  // Continue independent modal checks even when the live typing calibration fails.
  await field.fill(draft);
  for (const [width, height] of frames) {
    await resize(width, height);
    await check(`report-resize-${width}`, async () => {
      assert.equal(await field.inputValue(), draft);
      await field.focus();
      for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        const state = await focusState(page);
        focusEvents.push({ width, key, ...state });
        if (state.withinSheet || state.withinDialog) continue;
        const calibratedChrome = nativeTabControl.some(event => event.key === key && !event.documentFocused
          && event.activeTag === "BODY" && event.modal && event.nextInside);
        if (calibratedChrome && !state.documentFocused && state.activeTag === "BODY" && state.modal) {
          // Native dialog may yield to browser chrome, never to page controls.
          await trigger.evaluate(element => element.focus());
          assert.equal(await trigger.evaluate(element => element === document.activeElement), false, "Background trigger was not inert");
          await page.keyboard.press(key);
          const returned = await focusState(page);
          focusEvents.push({ width, key, returnFromChrome: true, ...returned });
          assert(returned.withinDialog, "Tab did not return from browser chrome to the modal");
        } else assert.fail(`${key} left the report modal: ${JSON.stringify(state)}`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    });
    await capture(`report-${width}`);
  }
  await check("report-escape-focus-return", async () => {
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });
    assert(await trigger.evaluate(element => element === document.activeElement));
  });
  await check("report-draft-preserved", async () => {
    await trigger.focus();
    await trigger.press("Enter");
    await field.waitFor();
    assert.equal(await field.inputValue(), draft);
    await sheet.locator(".play-sheet-bar button").click();
    await sheet.waitFor({ state: "hidden" });
  });

  for (const game of ["roulette", "keno"]) {
    await open(game);
    const controls = page.locator(".casino-controls");
    if (game === "roulette") await controls.getByRole("button", { name: "Straight", exact: true }).click();
    const board = controls.locator(`.casino-${game}-board`);
    await board.getByRole("button", { name: "17", exact: true }).click();
    const expected = await board.locator('[aria-pressed="true"]').allTextContents();
    const alternate = await board.locator('button[aria-pressed="false"]:not(:disabled)').first().textContent();
    for (const [width, height] of frames) {
      await resize(width, height);
      await check(`${game}-targets-${width}`, async () => {
        const boxes = await board.locator("button").evaluateAll(buttons => buttons.map(button => {
          const rect = button.getBoundingClientRect(); return { text: button.textContent, width: rect.width, height: rect.height };
        }));
        assert.equal(boxes.length, game === "roulette" ? 37 : 80);
        const small = boxes.filter(box => box.width < 43.99 || box.height < 43.99);
        assert.equal(small.length, 0, `${small.length} targets below44px: ${JSON.stringify(small.slice(0, 3))}`);
      });
      await check(`${game}-selection-${width}`, async () => {
        assert.deepEqual(await board.locator('[aria-pressed="true"]').allTextContents(), expected);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await board.getByRole("button", { name: alternate, exact: true }).click();
        assert.equal(await board.getByRole("button", { name: alternate, exact: true }).getAttribute("aria-pressed"), "true");
        if (game === "keno") await board.getByRole("button", { name: alternate, exact: true }).click();
        else await board.getByRole("button", { name: "17", exact: true }).click();
      });
      await capture(`${game}-${width}`);
      await check(`${game}-scrolled-action-${width}`, async () => {
        const action = controls.locator(".casino-actionbar .casino-deal");
        assert.equal(await action.count(), 1, "Action bar missing");
        await board.locator("button").last().scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert(await action.evaluate(button => {
          const box = button.getBoundingClientRect();
          return box.width >= 44 && box.height >= 44 && box.top >= 0 && box.bottom <= innerHeight + 1
            && button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
        }), "Primary action is hidden or covered after scrolling the number grid");
        await capture(`${game}-scrolled-${width}`, false);
      });
    }
  }

  await open("video-poker");
  const controls = page.locator(".casino-controls");
  await controls.locator(".casino-stake input").fill("35");
  await controls.getByRole("button", { name: "Deal", exact: true }).click();
  const table = page.locator('section.casino-table[data-phase="playing"]');
  await table.waitFor();
  const held = table.getByRole("button", { name: "Hold 1", exact: true });
  await held.click();
  const hand = await table.locator(".casino-cards").innerText();
  for (const [width, height] of frames) {
    await resize(width, height);
    await check(`active-hand-controls-${width}`, async () => {
      assert.equal(await controls.locator(".casino-stake input").count(), 0, "Editable next bet remains during active hand");
      assert.equal(await controls.locator(".casino-chip-options").count(), 0, "Inactive chip controls remain during active hand");
      assert.equal(await controls.locator(".casino-live-stake strong").innerText(), "35");
      const action = controls.getByRole("button", { name: "Draw", exact: true });
      assert(await action.isEnabled());
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox();
      assert(box && box.width >= 44 && box.height >= 44 && box.y >= 0 && box.y + box.height <= height + 1);
      assert.equal(await table.locator(".casino-cards").innerText(), hand);
      assert.equal(await held.getAttribute("aria-pressed"), "true");
    });
    await capture(`active-hand-${width}`);
  }
  await controls.getByRole("button", { name: "Draw", exact: true }).click();
  await page.locator('section.casino-table[data-phase="complete"]').waitFor();
  await check("settled-draft-preserved", async () => {
    assert.equal(await controls.locator(".casino-stake input").inputValue(), "35");
  });
  await check("no-writes-or-runtime-errors", async () => { assert.deepEqual(writes, []); assert.deepEqual(errors, []); });
} finally {
  await writeFile(new URL(`controls-${engine}.json`, output), JSON.stringify({ schema: 1, calibration, engine, target, observations, nativeTabControl, focusEvents, readinessFailures, network, results, writes, errors }, null, 2));
  await context.close();
  await browser.close();
}
const failed = results.filter(result => result.status === "failed");
if (calibration) {
  assert(failed.some(result => ["report-typing-focus", "roulette-targets-320", "keno-targets-320"].includes(result.id)), "Live calibration did not reproduce any expected defect");
  assert.equal(results.find(result => result.id === "no-writes-or-runtime-errors")?.status, "passed");
  assert.equal(results.find(result => result.id === "settled-draft-preserved")?.status, "passed");
} else assert.deepEqual(failed, [], "Candidate controls checks failed");
