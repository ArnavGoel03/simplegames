import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { candidates, engine, observeSource, omitServiceWorkerCapability, output } from "./browser-evidence.mjs";
import { syntheticState, fixtureId } from "./engagement-fixture.mjs";

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
const checks = [], errors = [], requests = [], writes = [];
let captureNumber = 0;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function capture(page, name) {
  await settle(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await page.screenshot({ path: new URL(`engagement-${engine}-${String(++captureNumber).padStart(2, "0")}-${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
  assert.equal(overflow, false, `${name} horizontally overflows`);
}
async function scenario(candidate, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", serviceWorkers: "block", reducedMotion: "reduce" });
  await context.addInitScript(omitServiceWorkerCapability);
  await context.addCookies([{ name: session.hintCookie, value: "1", url: candidate.origin, secure: true, sameSite: "Lax" }]);
  const state = syntheticState(fixture, candidates);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(20_000);
  page.on("pageerror", error => errors.push(error.message));
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
  try { await run({ context, page, state }); }
  catch (error) { errors.push(String(error)); await capture(page, "failure").catch(() => {}); throw error; }
  finally { requests.push(...state.requests); writes.push(...state.writes); await context.close(); }
}
async function visit(page, candidate, path) {
  const response = await page.goto(new URL(path, candidate.origin).href, { waitUntil: "domcontentloaded" });
  assert(response?.ok());
  await observeSource(page, candidate.site);
}
async function bounded(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 15_000); })]); }
  finally { clearTimeout(timer); }
}
const focus = page => page.evaluate(() => window.dispatchEvent(new Event("focus")));

try {
  await scenario(board, async ({ context, page, state }) => {
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
    await rematch.click(); await page.waitForURL("**/r/fixture-rematch-42?g=rummy");
    checks.push("Rivals support explicit Add/Accept, decline, refused rematch and correct Rummy room handoff");
    await visit(page, board, "/account");
    await page.locator("#rivals").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll("#rivals button")].some(button => button.textContent === "Cancel"));
    state.offers.push({ ...state.offers[0], id: fixtureId(22), roomId: "fixture-inbox-43", status: "pending" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#rivals").getByRole("button", { name: "Accept", exact: true }).click();
    await page.waitForURL("**/r/fixture-inbox-43?g=rummy");
    checks.push("An outgoing invitation can be cancelled and an incoming invitation explicitly accepted");
    await visit(page, board, "/account");
    state.current = state.players[1]; await focus(page);
    await page.waitForFunction(() => document.querySelector('a[href="/player/fixture-bishop"]') !== null);
    await continuation.getByRole("link", { name: /Klondike/ }).waitFor();
    assert.equal(await continuation.getByRole("link", { name: /FreeCell/ }).count(), 0);
    await continuation.getByText("fixture-owner-2-42", { exact: true }).waitFor();
    assert.equal(await continuation.getByText("fixture-owner-1-42", { exact: true }).count(), 0);
    await capture(page, "account-second-owner");
    checks.push("Account switching replaces continuation and room ownership without showing prior-owner saves");
  });

  await scenario(board, async ({ context, page, state }) => {
    await context.addInitScript(() => {
      window.__shareCalls = []; window.__copied = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: async data => { window.__shareCalls.push(data); throw new DOMException("cancelled", "AbortError"); } });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__copied.push(text); } } });
    });
    await visit(page, board, "/account");
    const shell = await page.evaluate(() => ({ htmlClass: document.documentElement.className,
      styles: [...document.head.querySelectorAll('style,link[rel="stylesheet"]')].map(element => element.outerHTML).join("") }));
    const component = await readFile(new URL("engagement-component.js", directory));
    assert.equal(createHash("sha256").update(component).digest("hex"), fixture.componentSha256);
    const url = new URL("/__engagement_fixture__", board.origin).href;
    await context.route(`${url}.js`, route => route.fulfill({ contentType: "text/javascript", body: component }));
    await context.route(url, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html class="${shell.htmlClass}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${shell.styles}</head><body><main id="fixture" class="mx-auto max-w-3xl p-4"></main><script src="${url}.js"></script></body></html>` }));
    await page.goto(url, { waitUntil: "load" });
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

  await scenario(board, async ({ page, state }) => {
    assert.equal(fixture.daily.day, new Date().toISOString().slice(0, 10), "Regenerate Daily fixture after a UTC day rollover");
    state.set(fixture.owners[0], "daily", fixture.daily.data);
    await visit(page, board, "/daily");
    const resumed = () => page.waitForFunction(() => [...document.querySelectorAll(".play-label")].some(node => {
      const match = /Roll (\d+) of/.exec(node.textContent ?? ""); return match && Number(match[1]) >= 8;
    }));
    await resumed();
    state.soloOffline = true;
    await page.reload({ waitUntil: "domcontentloaded" }); await resumed();
    await capture(page, "daily-cloud-offline-resume");
    checks.push("Daily resumes a canonical eight-roll cloud board and preserves it across a solo-API-offline reload");
  });

  for (const slot of ["freecell", "klondike", "spider"]) await scenario(cards, async ({ page, state }) => {
    const owner = fixture.owners[0];
    state.set(owner, slot, fixture.saves[slot][0]); state.set(fixture.owners[1], slot, fixture.saves[slot][1]);
    await visit(page, cards, `/solitaire/${slot}`);
    const moves = number => page.getByText(`${number} ${number === 1 ? "move" : "moves"}`, { exact: true }).first();
    await moves(1).waitFor();
    assert.equal(state.writes.length, 0, "Hydration must not overwrite the cloud board with a fresh game");
    await capture(page, `${slot}-cloud-resume`);
    if (slot !== "freecell") { checks.push(`${slot}: actual game resumes the canonical cloud move`); return; }
    let release;
    state.identityGate = new Promise(resolve => { release = resolve; });
    const arrived = new Promise(resolve => { state.identitySeen = resolve; });
    await focus(page);
    await bounded(arrived, "Identity refresh did not arrive");
    await moves(1).waitFor();
    await page.getByRole("button", { name: "Undo", exact: true }).click(); await moves(0).waitFor();
    await page.waitForTimeout(900);
    assert.equal(state.writes.length, 0, "Background verification must preserve the board while pausing cloud writes");
    state.soloOffline = true; release(); state.identityGate = null;
    checks.push("Background account verification preserves the active board while pausing cloud writes");
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? "null")?.local?.save?.steps?.length === 0, fixture.soloKeys[owner][slot]);
    await page.reload({ waitUntil: "domcontentloaded" }); await moves(0).waitFor();
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
    state.current = state.players[1]; await focus(page); await moves(2).waitFor();
    await capture(page, "freecell-second-owner");
    assert.equal(state.writes.filter(write => write.owner === fixture.owners[1]).length, 0, "Switching account must not write the previous board to its new owner");
    checks.push("Changing account restores that owner's independent Solitaire board without cross-account writes");
  });
  await scenario(cards, async ({ context, page, state }) => {
    state.set(fixture.owners[0], "freecell", fixture.saves.freecell[0]);
    await visit(page, cards, "/solitaire/freecell");
    await page.getByText("1 move", { exact: true }).first().waitFor();
    const second = await context.newPage(); second.setDefaultTimeout(15_000);
    second.on("pageerror", error => errors.push(error.message));
    await visit(second, cards, "/solitaire/freecell");
    await second.getByText(fixture.copy.pending, { exact: true }).waitFor();
    await capture(second, "freecell-second-tab-waits");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByText("0 moves", { exact: true }).first().waitFor();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? "null")?.local?.save?.steps?.length === 0, fixture.soloKeys[fixture.owners[0]].freecell);
    await page.close();
    await second.getByText("0 moves", { exact: true }).first().waitFor();
    await capture(second, "freecell-second-tab-takes-over");
    checks.push("A second same-account tab waits for the writer lock and restores latest local state after takeover");
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(new URL(`engagement-${engine}.json`, output), JSON.stringify({ sourceHead: fixture.sourceHead, sourceFingerprint: fixture.sourceFingerprint,
    componentSha256: fixture.componentSha256, checks, requests, writes, errors,
    scope: "Actual candidate account and solitaire pages plus actual source-bundled recap component. Synthetic intercepted APIs only; offline scenario isolates solo API failure while identity/document delivery remains available. Room handoff stops before sockets. No production account, invite, room or database mutation.",
  }, null, 2));
  await browser.close();
}
console.log(`Verified ${checks.length} engagement interaction scenarios`);
