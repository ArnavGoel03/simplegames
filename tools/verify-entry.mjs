import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import catalogue from "../src/lib/game-catalogue.json" with { type: "json" };
import { candidates, observeSource, recordEvidence, instrument } from "./browser-evidence.mjs";

// Public UI checks only. Both origins are explicit; no local server is started.
// BROWSER_ENGINE=chromium|webkit, PLAY_ENTRY_CIRCUIT_URL, PLAY_ENTRY_LATTICE_URL.
const labels = { solo: "Play on your own", friends: "Play with friends", stranger: "Play a stranger" };
const queue = { join: labels.stranger, cancel: "Stop looking" };
const engine = process.env.BROWSER_ENGINE || "chromium";
assert(["chromium", "webkit"].includes(engine), "Unknown browser engine");

function target(game, id, value) {
  assert(value, `Set PLAY_ENTRY_${game.toUpperCase()}_URL to the candidate origin`);
  const url = new URL(value);
  const canonical = catalogue.sites.find(site => site.id === id)?.url;
  assert(canonical, `Missing catalogue entry: ${id}`);
  assert(url.protocol === "https:" && !url.username && !url.password && !url.port
    && url.pathname === "/" && !url.search && !url.hash
    && (url.origin === new URL(canonical).origin || url.hostname.endsWith(".goelhome.workers.dev")),
  `Unexpected entry target: ${url.origin}`);
  return { game, origin: url.origin };
}

const targets = candidates.length ? candidates.filter(item => ["board", "words"].includes(item.site)).map(item => ({
  game: item.site === "board" ? "circuit" : "lattice", origin: item.origin,
})) : [
  target("circuit", "chaupal", process.env.PLAY_ENTRY_CIRCUIT_URL),
  target("lattice", "lattice", process.env.PLAY_ENTRY_LATTICE_URL),
];
assert(process.argv.slice(2).every(arg => arg === "--check-targets"), "Unknown entry verifier option");
if (process.argv.includes("--check-targets")) {
  console.log(JSON.stringify({ engine, targets }));
} else {
  await run();
}

async function waitFor(read, expected, message) {
  const until = Date.now() + 8_000;
  let actual;
  do {
    actual = await read();
    if (actual === expected) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < until);
  assert.equal(actual, expected, message);
}

async function bounded(action, milliseconds) {
  let timeout;
  try {
    return await Promise.race([
      action(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`Entry check exceeded ${milliseconds}ms`)), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function controls(page) {
  const entry = page.locator(".play-entry");
  return {
    entry,
    choices: entry.locator(".play-entry-choices"),
    active: entry.locator(".play-entry-panel:not([hidden])"),
    seats: entry.locator(".play-entry-panel").first().locator(".play-entry-details"),
  };
}

async function choose(page, intent, keyboard = false) {
  const { entry, choices } = controls(page);
  const button = choices.getByRole("button", { name: labels[intent], exact: true });
  if (keyboard) { await button.focus(); await button.press("Enter"); }
  else await button.click();
  await waitFor(() => button.getAttribute("aria-pressed"), "true", `Intent did not change: ${intent}`);
  assert.equal(await entry.locator(".play-entry-panel:not([hidden])").count(), 1, "Exactly one panel must be actionable");
  return button;
}

async function pressed(button) {
  await waitFor(() => button.getAttribute("aria-pressed"), "true", "Selected draft did not survive");
}

async function resizePlay(page, game, capture) {
  await page.keyboard.press("Escape");
  const surface = page.locator(game === "circuit" ? ".play-board-surface" : '[aria-label="The board, 15 by 15"]');
  await surface.waitFor({ state: "visible" });
  const suffix = game === "circuit" ? "game-state" : "solo-lattice";
  const saved = () => page.evaluate(suffix => {
    const key = Object.keys(localStorage).find(key => key.endsWith(suffix));
    return key ? localStorage.getItem(key) : null;
  }, suffix);
  const before = await saved();
  assert(before, "Local game must be saved before resize");
  const documentId = await page.evaluate(() => { window.resizeDocument = crypto.randomUUID(); return window.resizeDocument; });
  for (const [width, height] of [[320, 720], [844, 390], [690, 829], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.resizeDocument), documentId, "Resize navigated away from the active game");
    assert.equal(await saved(), before, "Resize changed the local game");
    assert(await surface.isVisible(), "Resize hid the game");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "In-play resize overflows");
    await capture(`playing-${width}x${height}`);
  }
  if (game === "lattice") {
    const tile = page.locator('[aria-label="Your tiles"] button').first();
    await tile.click();
    assert.equal(await tile.getAttribute("data-held"), "true", "A tile cannot be selected after resize");
  } else {
    const roll = page.getByRole("button", { name: /Roll/ }).first();
    assert(await roll.isEnabled(), "The roll action is disabled after resize");
    await roll.click();
  }
}

async function run() {
  const output = new URL("../.audit/visual/", import.meta.url);
  await mkdir(output, { recursive: true });
  const report = { engine, startedAt: new Date().toISOString(), targets, checks: [], passed: false };
  const saveReport = () => writeFile(new URL("entry-report.json", output), JSON.stringify(report, null, 2));
  let browser;

  const checks = [
    ["intent-isolation", async ({ page, origin, traffic, capture }) => {
      const { entry, choices } = controls(page);
      await pressed(choices.getByRole("button", { name: labels.solo, exact: true }));
      await capture("arrival");
      for (const intent of ["friends", "stranger", "solo"]) {
        await choose(page, intent);
        assert.equal(page.url(), `${origin}/`, "Choosing an intent must not navigate");
      }
      const join = entry.getByLabel("Or join one you were sent");
      assert.equal(await join.count(), 1, "The inactive room draft must remain mounted");
      assert.equal(await join.isVisible(), false, "The inactive room form must not be visible");
      assert.equal(traffic.tickets, 0, "Choosing an intent must not request a queue ticket");
      assert.equal(traffic.sockets, 0, "Choosing an intent must not open a queue socket");
    }],
    ["drafts-and-queue-cancellation", async ({ page, game, traffic, capture }) => {
      const { active, seats } = controls(page);
      if (game === "circuit") {
        await seats.locator("summary").click();
        await seats.locator(".play-seat").nth(1).getByRole("button", { name: "Master", exact: true }).click();
        const rules = active.locator("details").filter({ has: page.locator("summary", { hasText: "House rules" }) });
        await rules.locator("summary").click();
        await rules.locator("button").first().click();
      }
      await choose(page, "friends");
      await active.getByLabel("Or join one you were sent").fill("tiger-boat-42");
      if (game === "circuit") {
        await active.locator("summary", { hasText: "How many chairs" }).click();
        await active.getByRole("button", { name: "Royale 4", exact: true }).click();
      }
      await choose(page, "stranger");
      if (game === "circuit") await active.getByRole("button", { name: "Duel Rapid", exact: true }).click();
      assert.equal(traffic.sockets, 0, "Selecting a preset must not enter its queue");
      await active.getByRole("button", { name: queue.join, exact: true }).click();
      await active.getByRole("button", { name: queue.cancel, exact: true }).waitFor({ state: "visible" });
      await waitFor(() => traffic.sockets, 1, "The explicit queue action must open one socket");
      assert.equal(traffic.tickets, 1, "The queue action must mint only one ticket");
      await choose(page, "friends");
      await waitFor(() => traffic.closed, 1, "Leaving the queue must close its socket");
      assert.equal(await active.getByLabel("Or join one you were sent").inputValue(), "tiger-boat-42", "Room link draft was lost");
      if (game === "circuit") await pressed(active.getByRole("button", { name: "Royale 4", exact: true }));
      await choose(page, "stranger");
      await active.getByRole("button", { name: queue.join, exact: true }).waitFor({ state: "visible" });
      if (game === "circuit") await pressed(active.getByRole("button", { name: "Duel Rapid", exact: true }));
      assert.equal(traffic.sockets, 1, "Returning to the queue panel must not restart matchmaking");
      await choose(page, "solo");
      if (game === "circuit") {
        assert.equal(await seats.getAttribute("open"), "", "Local seat disclosure was reset");
        await pressed(seats.locator(".play-seat").nth(1).getByRole("button", { name: "Master", exact: true }));
        const rules = active.locator("details").filter({ has: page.locator("summary", { hasText: "House rules" }) });
        await pressed(rules.locator("button").first());
        await active.getByRole("link", { name: /The Daily/ }).waitFor({ state: "visible" });
      }
      await capture("retained-drafts");
    }],
    ["local-navigation-and-resume", async ({ page, game, origin, capture }) => {
      const { entry } = controls(page);
      if (game === "circuit") {
        await entry.getByRole("button", { name: "Start the game", exact: true }).click();
        await page.waitForURL(`${origin}/play`, { waitUntil: "domcontentloaded" });
        await resizePlay(page, game, capture);
        await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
        await entry.getByRole("button", { name: "Back to the board", exact: true }).waitFor({ state: "visible" });
        await choose(page, "friends");
        await entry.getByRole("button", { name: "Open a room", exact: true }).waitFor({ state: "visible" });
        await choose(page, "solo");
        await entry.getByRole("button", { name: "Back to the board", exact: true }).waitFor({ state: "visible" });
      } else {
        await entry.getByRole("link", { name: "Play on your own, against the computer", exact: true }).click();
        await page.waitForURL(`${origin}/solo`, { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Set up the board", exact: true }).waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Deal the tiles", exact: true }).click();
        await resizePlay(page, game, capture);
      }
      await capture("local-play");
    }],
    ["responsive-keyboard-and-motion", async ({ page, result, capture }) => {
      // Calibrate under the candidate's actual overflow and containment rules.
      const detects = await page.evaluate(() => {
        const before = document.documentElement.scrollWidth;
        const box = document.createElement("div");
        box.style.cssText = "position:absolute;left:0;top:0;width:200vw;height:1px";
        document.body.append(box);
        const positive = document.documentElement.scrollWidth > innerWidth + 1;
        box.remove();
        return positive && document.documentElement.scrollWidth === before;
      });
      assert(detects, "Overflow detector failed positive calibration or cleanup");
      result.overflowCalibrated = true;
      result.layouts = [];
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
        for (const intent of Object.keys(labels)) {
          const choice = await choose(page, intent, true);
          assert(await choice.evaluate(element => element === document.activeElement), "Keyboard selection lost focus");
          const box = await choice.boundingBox();
          assert(box && box.height >= 44, "Intent target is shorter than 44px");
          assert(box.x >= -1 && box.x + box.width <= width + 1, "Intent target is clipped horizontally");
          const layout = await choice.evaluate(element => {
            const style = getComputedStyle(element);
            return {
              width: innerWidth,
              documentWidth: document.documentElement.scrollWidth,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              animation: style.animationName,
              transition: style.transitionDuration,
              focusOutline: style.outlineStyle,
            };
          });
          assert.equal(layout.overflow, false, `${width}px ${intent} overflows horizontally`);
          assert.equal(layout.animation, "none", "Reduced motion must stop entry animation");
          assert(layout.transition.split(",").every(value => parseFloat(value) === 0), "Reduced motion must stop entry transitions");
          assert.notEqual(layout.focusOutline, "none", "Keyboard selection must have a visible focus outline");
          result.layouts.push({ intent, ...layout });
          await capture(`${width}-${intent}`);
        }
      }
    }],
  ];

  try {
    browser = await ({ chromium, webkit })[engine].launch({ timeout: 20_000 });
    for (const { game, origin } of targets) {
      for (const [name, check] of checks) {
        const result = { game, name, origin, passed: false, captures: [], errors: [] };
        report.checks.push(result);
        const started = Date.now();
        console.log(JSON.stringify({ event: "entry-start", engine, game, name }));
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", serviceWorkers: "block" });
        const page = await context.newPage();
        page.setDefaultTimeout(8_000);
        page.setDefaultNavigationTimeout(20_000);
        const probe = await instrument(page);
        result.errors = probe.errors;
        result.networkTrace = probe.trace;
        const traffic = { tickets: 0, guests: 0, sockets: 0, closed: 0, rooms: 0 };
        page.on("request", request => {
          if (request.isNavigationRequest() && new URL(request.url()).pathname.startsWith("/r/")) traffic.rooms += 1;
        });
        await page.route("**/api/realtime/ticket", route => {
          traffic.tickets += 1;
          return route.fulfill({ json: { ticket: "entry-test-ticket" } });
        });
        await page.route("**/api/identity/guest", route => { traffic.guests += 1; return route.abort(); });
        await page.routeWebSocket("**/queue/**", socket => {
          traffic.sockets += 1;
          socket.onClose(() => { traffic.closed += 1; });
          socket.send(JSON.stringify({ kind: "waiting" }));
        });
        const capture = async suffix => {
          const file = `entry-${game}-${engine}-${name}-${suffix}.jpg`;
          await page.screenshot({ path: new URL(file, output).pathname, fullPage: false, type: "jpeg", quality: 82, timeout: 5_000 });
          result.captures.push(file);
        };
        try {
          await bounded(async () => {
            const response = await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
            assert(response?.ok(), `${origin}: HTTP ${response?.status()}`);
            result.observedSourceHead = await observeSource(page, game === "circuit" ? "board" : "words");
            await controls(page).entry.waitFor({ state: "visible" });
            await page.evaluate(() => document.fonts.ready);
            await check({ page, game, origin, traffic, capture, result });
            assert.equal(traffic.guests, 0, "An entry check attempted a guest write");
            assert.equal(traffic.rooms, 0, "An entry check attempted to navigate to a room");
            assert.deepEqual(result.errors, [], "The candidate raised browser errors");
          }, 30_000);
          result.passed = true;
        } catch (error) {
          result.failure = String(error);
          console.error(JSON.stringify({ event: "entry-failed", game, name, error: result.failure }));
          try { await capture("failure"); }
          catch (captureError) { result.captureFailure = String(captureError); }
        } finally {
          result.durationMs = Date.now() - started;
          result.traffic = { ...traffic };
          if (result.observedSourceHead) {
            await recordEvidence(game === "circuit" ? "board" : "words", result.observedSourceHead,
              [{ id: "entry", status: result.passed ? "passed" : "failed" },
                ...(name === "local-navigation-and-resume" ? [{ id: "resize-play", status: result.passed ? "passed" : "failed" }] : [])]);
          }
          await bounded(() => context.close(), 5_000);
          await saveReport();
          console.log(JSON.stringify(result));
        }
      }
    }
    report.passed = report.checks.length === targets.length * checks.length && report.checks.every(check => check.passed);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    report.failure = String(error);
    process.exitCode = 1;
    console.error(error);
  } finally {
    report.finishedAt = new Date().toISOString();
    await saveReport();
    if (browser) await bounded(() => browser.close(), 5_000);
  }
}
