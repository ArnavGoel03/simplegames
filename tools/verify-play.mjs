import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, output, observeSource, recordEvidence, instrument } from "./browser-evidence.mjs";

import { waitForReady, dismissFirstGuide } from "./gameplay-controls.mjs";

assert(candidates.length, "In-play checks require immutable candidates");
await mkdir(output, { recursive: true });
const browser = await ({ chromium, webkit })[engine].launch({ timeout: 20_000 });
const results = [];
const frames = [[320, 720], [844, 390], [690, 829], [1440, 1000], [2560, 1080]];

async function resize(page, site, capture, verify) {
  const identity = await page.evaluate(() => { window.resizeIdentity = crypto.randomUUID(); return window.resizeIdentity; });
  for (const [width, height] of frames) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.resizeIdentity), identity, "In-play resize navigated");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${site} overflows at ${width}x${height}`);
    await verify();
    await capture(`${width}x${height}`);
  }
}

async function casino(page, candidate, capture) {
  await page.goto(`${candidate.origin}/casino/video-poker?mode=practice`, { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  const table = page.locator('section.casino-table[data-game="video-poker"][data-phase="playing"]');
  await table.waitFor();
  const held = table.getByRole("button", { name: "Hold 1", exact: true });
  await held.click();
  const hand = await table.locator(".casino-cards").innerText();
  await resize(page, candidate.site, capture, async () => {
    assert(await table.isVisible(), "Resize lost the active hand");
    assert.equal(await table.locator(".casino-cards").innerText(), hand, "Resize changed the dealt hand");
    assert.equal(await held.getAttribute("aria-pressed"), "true", "Resize lost the held card");
  });
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.locator('section.casino-table[data-phase="complete"]').waitFor();
  return { checks: ["held hand preserved", "draw completes after resize"] };
}

async function deal(page, candidate, capture) {
  await page.goto(`${candidate.origin}/solitaire/freecell`, { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await dismissFirstGuide(page);
  const table = page.locator('.play-sol:not([aria-hidden="true"])');
  await table.waitFor();
  const pile = table.locator('.play-sol-pile[data-kind="tableau"]').first();
  await pile.waitFor();
  const layout = await table.locator(".play-sol-pile").evaluateAll(piles => piles.map(pile => pile.getAttribute("aria-label")));
  await resize(page, candidate.site, capture, async () => {
    assert.deepEqual(await table.locator(".play-sol-pile").evaluateAll(piles => piles.map(pile => pile.getAttribute("aria-label"))), layout, "Resize changed the FreeCell deal");
  });
  await pile.focus();
  await pile.press("Enter");
  assert.equal(await pile.getAttribute("aria-pressed"), "true", "Card selection failed after resize");
  return { checks: ["all piles unchanged", "keyboard card selection works after resize"] };
}

async function draw(page, candidate, capture) {
  const you = "00000000-0000-4000-8000-000000000001";
  const other = "00000000-0000-4000-8000-000000000002";
  const sent = [];
  let tickets = 0;
  let guests = 0;
  const stroke = { tool: "pen", color: "#2563eb", width: 20, points: [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.7 }] };
  await page.route("**/api/realtime/ticket", route => { tickets++; return route.fulfill({ json: { ticket: "browser-fixture" } }); });
  await page.route("**/api/identity/guest", route => { guests++; return route.abort(); });
  await page.routeWebSocket("**/draw/**", socket => {
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      sent.push(message);
      if (message.type === "ping") socket.send(JSON.stringify({ type: "pong", now: Date.now() }));
    });
    const now = Date.now();
    socket.send(JSON.stringify({ type: "state", you, host: you, phase: "drawing", round: 9, mode: "classic", artist: you,
      word: "house", hint: "_____", choices: null, difficulty: "easy", customWords: 0, yourWords: null,
      votesIn: 0, yourVote: null, votes: null, endsAt: now + 600_000, paused: null, now,
      players: [{ id: you, name: "You", score: 0, connected: true, solved: false }, { id: other, name: "Player 2", score: 0, connected: true, solved: false }] }));
    socket.send(JSON.stringify({ type: "canvas", strokes: [stroke] }));
  });
  await page.goto(`${candidate.origin}/r/tiger-boat-42`, { waitUntil: "domcontentloaded" });
  await waitForReady(page);
  await page.getByRole("button", { name: "Play as guest", exact: true }).click();
  const room = page.locator('.draw-room[data-phase="drawing"][data-round="9"]');
  await room.waitFor();
  await dismissFirstGuide(page);
  const canvas = room.locator("canvas").first();
  // Wire widths are thousandths of canvas width, not normalized fractions.
  // A blank canvas must fail the same pixel predicate used after each resize.
  assert.equal(await page.evaluate(() => {
    const blank = document.createElement("canvas");
    const pixel = blank.getContext("2d").getImageData(0, 0, 1, 1).data;
    return pixel[2] > 150 && pixel[0] < 80 && pixel[3] > 200;
  }), false, "Ink detector accepted a blank canvas");
  const ink = () => canvas.evaluate(element => {
    const pixel = element.getContext("2d").getImageData(Math.floor(element.width * 0.3), Math.floor(element.height * 0.3), 1, 1).data;
    return pixel[2] > 150 && pixel[0] < 80 && pixel[3] > 200;
  });
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".draw-room canvas");
    if (!canvas) return false;
    const pixel = canvas.getContext("2d").getImageData(Math.floor(canvas.width * 0.3), Math.floor(canvas.height * 0.3), 1, 1).data;
    return pixel[2] > 150 && pixel[0] < 80;
  });
  await resize(page, candidate.site, capture, async () => {
    assert(await room.isVisible(), "Resize changed round or phase");
    assert(await ink(), "Resize lost normalized ink");
    const box = await canvas.boundingBox();
    assert(box && box.y + box.height <= page.viewportSize().height + 1, "Auto canvas exceeds available height");
  });
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 4 });
  await page.mouse.up();
  const deadline = Date.now() + 5_000;
  while (!sent.some(message => message.type === "stroke") && Date.now() < deadline) await page.waitForTimeout(50);
  assert(sent.some(message => message.type === "stroke"), "Drawing failed after resize");
  assert.equal(guests, 0, "Drawing fixture attempted a real guest write");
  assert.equal(tickets, 1, "Resize reopened the room connection");
  return { checks: ["same round9", "normalized ink preserved", "Auto fits height", "drawing works after resize"], fixture: "Actual deployed UI with intercepted ticket and protocol socket; no room/account writes" };
}

try {
  for (const candidate of candidates.filter(item => ["teenpatti", "cards", "draw"].includes(item.site))) {
    const context = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    page.setDefaultNavigationTimeout(20_000);
    const probe = await instrument(page);
    const result = { site: candidate.site, engine, passed: false, captures: [], trace: probe.trace };
    results.push(result);
    const capture = async size => {
      const file = `play-${candidate.site}-${engine}-${size}.jpg`;
      await page.screenshot({ path: new URL(file, output).pathname, fullPage: true, timeout: 5_000 });
      result.captures.push(file);
    };
    try {
      // Bind provenance on a separate page so hard navigation does not cancel
      // the homepage's in-flight prefetches in the gameplay error probe.
      const provenance = await context.newPage();
      try {
        const response = await provenance.goto(candidate.origin, { waitUntil: "domcontentloaded", timeout: 20_000 });
        assert(response?.ok(), "Candidate provenance failed");
        result.observedSourceHead = await observeSource(provenance, candidate.site);
      } finally { await provenance.close(); }
      Object.assign(result, await ({ teenpatti: casino, cards: deal, draw })[candidate.site](page, candidate, capture));
      assert.deepEqual(probe.errors, [], "In-play browser error");
      result.passed = true;
    } catch (error) { result.failure = String(error); process.exitCode = 1; await capture("failure").catch(() => {}); }
    finally {
      if (result.observedSourceHead) await recordEvidence(candidate.site, result.observedSourceHead, [{ id: "resize-play", status: result.passed ? "passed" : "failed" }]);
      await context.close();
      console.log(JSON.stringify(result));
      await writeFile(new URL(`play-${engine}.json`, output), JSON.stringify(results, null, 2));
    }
  }
} finally { await browser.close(); }
