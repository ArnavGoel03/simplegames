import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, observeSource, omitServiceWorkerCapability, output, instrument } from "./browser-evidence.mjs";
import { syntheticState, fixtureId, assertRestoredWrites, attemptScenario } from "./engagement-fixture.mjs";

import { prepareGameplayContext, waitForReady, dismissFirstGuide, waitForRenderedBoard } from "./gameplay-controls.mjs";

const directory = new URL("./fixtures/player-history/", import.meta.url);
if (!existsSync(new URL("engagement.json", directory))) {
  console.log("No synthetic engagement fixture supplied"); process.exit(0);
}
const fixture = JSON.parse(await readFile(new URL("engagement.json", directory), "utf8"));
const session = JSON.parse(await readFile(new URL("session.json", directory), "utf8"));
assert.equal(fixture.synthetic, true);
for (const source of [fixture, session]) for (const candidate of candidates) {
  assert.equal(source.sourceHead, candidate.sourceHead);
  assert.equal(source.sourceFingerprint, candidate.sourceFingerprint);
}
const board = candidates.find(row => row.site === "board");
const cards = candidates.find(row => row.site === "cards");
assert(board && cards, "Engagement requires board and cards candidates");
await mkdir(output, { recursive: true });
const browser = await ({ chromium, webkit })[engine].launch();
const diagnosticOnly = process.env.ENGAGEMENT_DIAGNOSTIC_ONLY === "true";
if (diagnosticOnly) console.log("Diagnostic only: this engagement run cannot certify release candidates");
const checks = [], errors = [], requests = [], writes = [], sourceObservations = [], scenarioResults = [], boardRenders = [], networkProbes = [];
const pageProbes = new WeakMap();
const visits = new WeakMap();
let captureNumber = 0;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function capture(page, name) {
  await settle(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await page.screenshot({ path: new URL(`engagement-${engine}-${String(++captureNumber).padStart(2, "0")}-${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
  assert.equal(overflow, false, `${name} horizontally overflows`);
}
async function observeScenarioPage(page, label) {
  const probe = await instrument(page);
  pageProbes.set(page, probe);
  networkProbes.push({ label, trace: probe.trace, errors: probe.errors, failed: probe.failed, counts: probe.counts });
}
function mark(page, event) { pageProbes.get(page)?.mark(event); }
async function drainBeforeNavigation(page) {
  if (page.url() === "about:blank") return;
  mark(page, "navigation-idle-start");
  try { await page.waitForLoadState("networkidle", { timeout: 15_000 }); }
  finally { mark(page, "navigation-idle-end"); }
}
async function goto(page, url, options) {
  await drainBeforeNavigation(page);
  const path = new URL(url).pathname;
  mark(page, `goto-start:${path}`);
  try { return await page.goto(url, options); }
  finally { mark(page, `goto-end:${path}`); }
}
async function reload(page) {
  await drainBeforeNavigation(page);
  mark(page, "reload-start");
  try { return await page.reload({ waitUntil: "domcontentloaded" }); }
  finally { mark(page, "reload-end"); }
}
async function handoff(page, click, pattern) {
  await drainBeforeNavigation(page);
  mark(page, "room-handoff-start");
  try { await click(); await page.waitForURL(pattern); }
  finally { mark(page, "room-handoff-end"); }
}
async function scenario(label, candidate, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", serviceWorkers: "block", reducedMotion: "reduce" });
  await prepareGameplayContext(context);
  await context.addInitScript(omitServiceWorkerCapability);
  await context.addCookies([{ name: session.hintCookie, value: "1", url: candidate.origin, secure: true, sameSite: "Lax" }]);
  const state = syntheticState(fixture, candidates);
  const page = await context.newPage();
  await observeScenarioPage(page, label);
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(20_000);
  page.on("pageerror", error => errors.push(`${label}: ${error.stack ?? error.message}`));
  await context.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === fixture.soloPath && state.soloOffline) return route.abort("internetdisconnected");
    if (url.pathname === "/api/identity/me" && state.identityGate) {
      state.identitySeen?.(); await state.identityGate;
    }
    const answer = state.answer({ path: url.pathname, method: request.method(), headers: request.headers(),
      body: request.postData() ? request.postDataJSON() : null, query: url.searchParams });
    await route.fulfill(answer.status ? { status: answer.status, json: answer.json } : { json: answer }).catch(error => {
      if (!/closed|disposed|aborted|Invalid InterceptionId/i.test(error.message)) throw error;
    });
  });
  // A UI handoff stops here, before sockets or any room mutation can occur.
  await context.route("**/r/fixture-*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic room handoff</title><p>Synthetic room handoff</p>" }));
  await page.routeWebSocket("**", socket => socket.close());
  const previousErrors = errors.length;
  try {
    const passed = await attemptScenario(label, () => run({ context, page, state }), () => capture(page, `${label}-failure`).catch(() => {}), errors);
    scenarioResults.push({ label, passed: passed && errors.length === previousErrors });
  }
  finally {
    requests.push(...state.requests); writes.push(...state.writes);
    const probes = context.pages().map(current => pageProbes.get(current)).filter(Boolean);
    probes.forEach(probe => probe.mark("context-close-start"));
    try { await context.close(); }
    finally { probes.forEach(probe => probe.mark("context-close-end")); }
  }
}
async function visit(page, candidate, path) {
  const context = page.context();
  const seen = visits.get(context) ?? new Set(); visits.set(context, seen);
  const solitaire = path.startsWith("/solitaire/");
  const solo = solitaire || path === "/daily";
  if (solitaire && !seen.has(candidate.origin)) {
    // Solitaire intentionally has no reading-page footer. Match verify-play's
    // existing provenance strategy on this exact immutable candidate origin.
    const provenance = await context.newPage();
    try {
      const response = await provenance.goto(candidate.origin, { waitUntil: "domcontentloaded", timeout: 20_000 });
      assert(response?.ok());
      const sourceHead = await observeSource(provenance, candidate.site);
      sourceObservations.push({ site: candidate.site, origin: candidate.origin, observedPath: "/", sourceHead });
      seen.add(candidate.origin);
    } finally { await provenance.close(); }
  }
  const response = await goto(page, new URL(path, candidate.origin).href, { waitUntil: "domcontentloaded" });
  assert(response?.ok());
  assert.equal(new URL(page.url()).origin, candidate.origin);
  assert.equal(new URL(page.url()).pathname, path);
  await waitForReady(page);
  if (solo) {
    if (!seen.has(path)) { await dismissFirstGuide(page); seen.add(path); }
    assert.equal(await page.locator(".play-sheet:visible").count(), 0, "The actual game must be visible after onboarding");
  }
  if (solitaire) {
    const scripts = await page.locator('script[src*="/_next/"]').evaluateAll(nodes => nodes.map(node => node.src));
    assert(scripts.length > 0 && scripts.every(url => new URL(url).origin === candidate.origin), "Solitaire scripts must load from the source-bound immutable origin");
    sourceObservations.push({ site: candidate.site, origin: candidate.origin, requestedPath: path, provenancePath: "/", scriptUrls: scripts });
  } else await observeSource(page, candidate.site);
}
async function bounded(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 15_000); })]); }
  finally { clearTimeout(timer); }
}
const focus = async page => {
  mark(page, "focus-start");
  try { return await page.evaluate(() => window.dispatchEvent(new Event("focus"))); }
  finally { mark(page, "focus-end"); }
};
const recordFor = (page, player) => page.getByRole("link", { name: "Your record", exact: true }).and(page.locator(`a[href="/player/${player.handle}"]`));
async function refreshAs(page, state, player) {
  const response = page.waitForResponse(reply => new URL(reply.url()).pathname === "/api/identity/me" && reply.request().method() === "GET");
  state.current = player;
  await focus(page);
  const refreshed = await response;
  assert(refreshed.ok());
  assert.equal((await refreshed.json()).player.id, player.id, "Focus must perform a fresh read of the switched identity");
}

try {
  await scenario("account", board, async ({ context, page, state }) => {
    state.set(fixture.owners[0], "freecell", fixture.saves.freecell[0]);
    state.set(fixture.owners[0], "daily", fixture.daily.data);
    state.set(fixture.owners[1], "klondike", fixture.saves.klondike[1]);
    await context.addInitScript(({ key, owners }) => {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, JSON.stringify(owners.map((ownerId, i) => ({ ownerId, id: `fixture-owner-${i + 1}-42`, definitionId: "rummy", seated: true, at: Date.now() }))));
    }, { key: fixture.roomsKey, owners: fixture.owners });
    await visit(page, board, "/account");
    const continuation = page.getByRole("region", { name: "Continue playing", exact: true });
    await continuation.getByRole("link", { name: /FreeCell/ }).waitFor();
    assert.equal(await continuation.getByRole("link", { name: /FreeCell/ }).getAttribute("href"), fixture.soloUrls.freecell);
    await continuation.getByText("fixture-owner-1-42", { exact: true }).waitFor();
    assert.equal(await continuation.getByText("fixture-owner-2-42", { exact: true }).count(), 0);
    await page.getByRole("region", { name: "Cross-game achievements", exact: true }).waitFor();
    const progressColors = await page.getByRole("progressbar").evaluateAll(bars => bars.map(bar => {
      const fill = bar.firstElementChild;
      if (!fill) return { named: bar.getAttribute("aria-label"), matched: false, calibrated: false };
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--play-fg)"; bar.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      const actual = getComputedStyle(fill).backgroundColor;
      const saved = fill.getAttribute("style");
      fill.style.backgroundColor = "transparent";
      const calibrated = getComputedStyle(fill).backgroundColor !== expected;
      if (saved === null) fill.removeAttribute("style"); else fill.setAttribute("style", saved);
      probe.remove();
      return { named: bar.getAttribute("aria-label"), matched: actual === expected, calibrated };
    }));
    assert(progressColors.length > 0 && progressColors.every(row => row.matched && row.calibrated), "Achievement fills must use the canonical foreground token");
    checks.push("Accessible achievement progress uses the canonical theme fill, with a wrong-color detector control");
    for (const [width, height] of [[390, 844], [844, 390], [1440, 900]]) {
      await page.setViewportSize({ width, height }); await capture(page, `account-${width}x${height}`);
    }
    checks.push("Actual account dashboard shows cloud continuation, career milestones and only this owner's local rooms");
    await page.setViewportSize({ width: 390, height: 844 });
    const rivals = page.locator("#rivals");
    await rivals.getByRole("button", { name: "Add", exact: true }).click();
    await rivals.locator("li").filter({ hasText: "Fixture knight" }).getByText("Waiting for an answer", { exact: true }).waitFor();
    await rivals.locator("li").filter({ hasText: "Fixture bishop" }).getByRole("button", { name: "Accept", exact: true }).click();
    const rematch = rivals.getByRole("button", { name: "Rematch", exact: true });
    await rematch.waitFor();
    await rivals.getByRole("button", { name: "Ignore", exact: true }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll("#rivals button")].some(button => button.textContent === "Ignore"));
    state.refuseCreate = true;
    await rematch.click(); await page.getByText("no player goes by that name", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/account");
    state.refuseCreate = false;
    await handoff(page, () => rematch.click(), "**/r/fixture-rematch-42?g=rummy");
    checks.push("Rivals support explicit Add/Accept, decline, refused rematch and correct Rummy room handoff");
    await visit(page, board, "/account");
    await page.locator("#rivals").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll("#rivals button")].some(button => button.textContent === "Cancel"));
    state.offers.push({ ...state.offers[0], id: fixtureId(22), roomId: "fixture-inbox-43", status: "pending" });
    await reload(page);
    await handoff(page, () => page.locator("#rivals").getByRole("button", { name: "Accept", exact: true }).click(), "**/r/fixture-inbox-43?g=rummy");
    checks.push("An outgoing invitation can be cancelled and an incoming invitation explicitly accepted");
    await visit(page, board, "/account");
    // The build stamp is server-rendered. Wait for the mounted provider's A
    // response before simulating a later cookie change and returning focus.
    await recordFor(page, state.players[0]).waitFor();
    await continuation.getByRole("link", { name: /FreeCell/ }).waitFor();
    await refreshAs(page, state, state.players[1]);
    await recordFor(page, state.players[1]).waitFor();
    await continuation.getByRole("link", { name: /Klondike/ }).waitFor();
    assert.equal(await continuation.getByRole("link", { name: /FreeCell/ }).count(), 0);
    await continuation.getByText("fixture-owner-2-42", { exact: true }).waitFor();
    assert.equal(await continuation.getByText("fixture-owner-1-42", { exact: true }).count(), 0);
    await capture(page, "account-second-owner");
    checks.push("Account switching replaces continuation and room ownership without showing prior-owner saves");
  });

  await scenario("recap", board, async ({ context, page, state }) => {
    await context.addInitScript(() => {
      window.__shareCalls = []; window.__copied = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: async data => { window.__shareCalls.push(data); throw new DOMException("cancelled", "AbortError"); } });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__copied.push(text); } } });
    });
    await visit(page, board, "/account");
    await recordFor(page, state.players[0]).waitFor();
    const shell = await page.evaluate(() => ({ htmlClass: document.documentElement.className,
      styles: [...document.head.querySelectorAll('style,link[rel="stylesheet"]')].map(element => element.outerHTML).join("") }));
    const component = await readFile(new URL("engagement-component.js", directory));
    assert.equal(createHash("sha256").update(component).digest("hex"), fixture.componentSha256);
    const url = new URL("/__engagement_fixture__", board.origin).href;
    await context.route(`${url}.js`, route => route.fulfill({ contentType: "text/javascript", body: component }));
    await context.route(url, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html class="${shell.htmlClass}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${shell.styles}</head><body><main id="fixture" class="mx-auto max-w-3xl p-4"></main><script src="${url}.js"></script></body></html>` }));
    await goto(page, url, { waitUntil: "load" });
    await page.getByRole("button", { name: "Rematch", exact: true }).waitFor();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.waitForFunction(() => window.__shareCalls.length === 1);
    await settle(page);
    assert.equal(await page.evaluate(() => window.__copied.length), 0);
    const share = await page.evaluate(() => window.__shareCalls[0]);
    assert(share.text.includes("Rummy") && share.text.includes("win") && share.text.includes("+16"));
    assert(share.url.includes("/games/"));
    await page.getByRole("button", { name: "Rematch", exact: true }).click();
    const dialog = page.getByRole("dialog"); await dialog.waitFor();
    await dialog.getByRole("heading", { name: "Rival rematches", exact: true }).waitFor();
    await capture(page, "recap-rematch-dialog");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await dialog.count(), 0);
    assert(state.requests.some(row => row.path === "/api/rivals"));
    checks.push("Generated actual MatchRecap+AccountProvider bundle shares result/rating, respects Share cancellation and opens usable native rematch dialog");
  });

  await scenario("daily", board, async ({ page, state }) => {
    assert.equal(fixture.daily.day, new Date().toISOString().slice(0, 10), "Regenerate Daily fixture after a UTC day rollover");
    state.set(fixture.owners[0], "daily", fixture.daily.data);
    await visit(page, board, "/daily");
    const resumed = () => page.waitForFunction(() => [...document.querySelectorAll(".play-label")].some(node => {
      const match = /Roll (\d+) of/.exec(node.textContent ?? ""); return match && Number(match[1]) >= 8;
    }));
    await resumed();
    boardRenders.push({ phase: "daily-cloud-resume", ...await waitForRenderedBoard(page) });
    state.soloOffline = true;
    await reload(page); await resumed();
    boardRenders.push({ phase: "daily-offline-reload", ...await waitForRenderedBoard(page) });
    await capture(page, "daily-cloud-offline-resume");
    checks.push("Daily resumes a canonical eight-roll cloud board and preserves it across a solo-API-offline reload");
  });

  for (const slot of ["freecell", "klondike", "spider"]) await scenario(slot, cards, async ({ page, state }) => {
    const owner = fixture.owners[0];
    state.set(owner, slot, fixture.saves[slot][0]); state.set(fixture.owners[1], slot, fixture.saves[slot][1]);
    await visit(page, cards, `/solitaire/${slot}`);
    const moves = number => page.getByText(`${number} ${number === 1 ? "move" : "moves"}`, { exact: true }).first();
    await moves(1).waitFor();
    assertRestoredWrites(state.writes, owner, slot, fixture.saves[slot][0].save);
    await capture(page, `${slot}-cloud-resume`);
    if (slot !== "freecell") { checks.push(`${slot}: actual game resumes the canonical cloud move`); return; }
    const writesBeforeVerification = state.writes.length;
    let release;
    state.identityGate = new Promise(resolve => { release = resolve; });
    const arrived = new Promise(resolve => { state.identitySeen = resolve; });
    await focus(page);
    await bounded(arrived, "Identity refresh did not arrive");
    await moves(1).waitFor();
    await page.getByRole("button", { name: "Undo", exact: true }).click(); await moves(0).waitFor();
    await page.waitForTimeout(900);
    assert.equal(state.writes.length, writesBeforeVerification, "Background verification must preserve the board while pausing cloud writes");
    state.soloOffline = true; release(); state.identityGate = null;
    checks.push("Background account verification preserves the active board while pausing cloud writes");
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? "null")?.local?.save?.steps?.length === 0, fixture.soloKeys[owner][slot]);
    await reload(page); await moves(0).waitFor();
    await capture(page, "freecell-offline-reload");
    checks.push("FreeCell Undo persists across reload while solo API transport is unavailable");
    state.set(owner, slot, fixture.saves[slot][2], 2); state.soloOffline = false;
    await focus(page);
    const cloud = page.getByRole("button", { name: new RegExp(`^${fixture.copy.cloud}`) });
    await cloud.waitFor(); await capture(page, "freecell-conflict");
    await cloud.click(); await moves(3).waitFor();
    await page.waitForFunction(key => (JSON.parse(localStorage.getItem(key) ?? "null")?.recovery?.length ?? 0) > 0, fixture.soloKeys[owner][slot]);
    await capture(page, "freecell-cloud-chosen");
    checks.push("CAS conflict offers an explicit choice and choosing cloud retains displaced local recovery");
    await refreshAs(page, state, state.players[1]); await moves(2).waitFor();
    await capture(page, "freecell-second-owner");
    assertRestoredWrites(state.writes, fixture.owners[1], slot, fixture.saves[slot][1].save);
    checks.push("Changing account restores that owner's independent Solitaire board without cross-account writes");
  });
  await scenario("tab-ownership", cards, async ({ context, page, state }) => {
    state.set(fixture.owners[0], "freecell", fixture.saves.freecell[0]);
    await visit(page, cards, "/solitaire/freecell");
    await page.getByText("1 move", { exact: true }).first().waitFor();
    const second = await context.newPage(); second.setDefaultTimeout(15_000);
    await observeScenarioPage(second, "tab-ownership:second");
    second.on("pageerror", error => errors.push(`tab-ownership: ${error.stack ?? error.message}`));
    await visit(second, cards, "/solitaire/freecell");
    await second.getByText(fixture.copy.pending, { exact: true }).waitFor();
    await capture(second, "freecell-second-tab-waits");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByText("0 moves", { exact: true }).first().waitFor();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? "null")?.local?.save?.steps?.length === 0, fixture.soloKeys[fixture.owners[0]].freecell);
    mark(page, "page-close-start");
    try { await page.close(); } finally { mark(page, "page-close-end"); }
    await second.getByText("0 moves", { exact: true }).first().waitFor();
    await capture(second, "freecell-second-tab-takes-over");
    checks.push("A second same-account tab waits for the writer lock and restores latest local state after takeover");
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(new URL(`engagement-${engine}.json`, output), JSON.stringify({ sourceHead: fixture.sourceHead, sourceFingerprint: fixture.sourceFingerprint,
    componentSha256: fixture.componentSha256, diagnosticOnly, standaloneCertification: false, checks, requests, writes, errors, scenarioResults, sourceObservations, boardRenders, networkProbes,
    scope: "Actual candidate account and solitaire pages plus actual source-bundled recap component. Synthetic intercepted APIs only; offline scenario isolates solo API failure while identity/document delivery remains available. Room handoff stops before sockets. No production account, invite, room or database mutation.",
  }, null, 2));
  await browser.close();
}
console.log(`Verified ${checks.length} engagement interaction scenarios`);
