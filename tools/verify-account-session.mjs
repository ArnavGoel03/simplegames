import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { engine, observeSource, omitServiceWorkerCapability, output } from "./browser-evidence.mjs";

async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} exceeded 15 seconds`)), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function verifyAccountSession(browser, candidate) {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/player-history/session.json", import.meta.url), "utf8"));
  assert.equal(fixture.sourceHead, candidate.sourceHead);
  assert.equal(fixture.sourceFingerprint, candidate.sourceFingerprint);
  assert(/^[a-zA-Z0-9_-]+$/.test(fixture.hintCookie));
  const players = ["rook", "bishop"].map((name, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`, kind: "registered", handle: `fixture-${name}`,
    displayName: `Fixture ${name}`, avatarSeed: `fixture-${name}`, countryCode: null, createdAt: "2026-09-20T10:00:00Z",
  }));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", serviceWorkers: "block", reducedMotion: "reduce" });
  await context.addInitScript(omitServiceWorkerCapability);
  await context.addCookies([{ name: fixture.hintCookie, value: "1", url: candidate.origin, secure: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  const requests = [];
  const checks = [];
  const held = [];
  let pending = null;
  let current = players[0];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = window.fetch;
    window.__sessionProbe = [];
    window.fetch = function(...args) {
      const url = new URL(typeof args[0] === "string" ? args[0] : args[0].url ?? args[0], location.href);
      if (url.pathname !== "/api/identity/me") return original.apply(this, args);
      const entry = { state: "pending" };
      window.__sessionProbe.push(entry);
      return original.apply(this, args).then(response => { entry.state = "resolved"; return response; }, error => {
        entry.state = error.name === "AbortError" ? "aborted" : "rejected";
        throw error;
      });
    };
  });
  function hold() {
    assert.equal(pending, null);
    let arrive, release, finish;
    const item = {
      arrived: new Promise(resolve => { arrive = resolve; }),
      release: value => release(value),
      done: new Promise(resolve => { finish = resolve; }),
      answer: new Promise(resolve => { release = resolve; }),
      arrive: () => arrive(), finish: value => finish(value),
    };
    pending = item;
    held.push(item);
    return item;
  }
  await context.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname, method: request.method() });
    if (url.pathname === "/api/identity/me") {
      const item = pending;
      if (!item) return route.fulfill({ json: { player: current } });
      pending = null;
      item.arrive();
      const answer = await item.answer;
      try { await route.fulfill({ status: answer.status ?? 200, json: { player: answer.player } }); item.finish(null); }
      catch (error) { item.finish(error.message); }
      return;
    }
    if (url.pathname === "/api/identity/sign-out" && request.method() === "POST") return route.fulfill({ json: { ok: true } });
    if (url.pathname === "/api/friends" && request.method() === "GET") return route.fulfill({ json: { friends: [] } });
    // No browser fixture request reaches an account, diagnostic store or ledger.
    return route.fulfill({ status: 404, json: {} });
  });
  const record = () => page.getByRole("link", { name: "Your record", exact: true });
  const focus = () => page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const capture = name => page.screenshot({ path: new URL(`session-${engine}-${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 85 });
  async function expectOwner(player, linked) {
    await page.getByText(player.displayName, { exact: true }).last().waitFor();
    if (linked) {
      await record().waitFor();
      assert.equal(await record().getAttribute("href"), `/player/${player.handle}`);
    } else {
      await page.waitForFunction(() => ![...document.querySelectorAll("a")].some(link => link.textContent === "Your record"));
      assert.equal(await record().count(), 0);
    }
  }
  try {
    const response = await page.goto(new URL("/account", candidate.origin).href, { waitUntil: "domcontentloaded", timeout: 20_000 });
    assert(response?.ok());
    await observeSource(page, "board");
    await expectOwner(players[0], true);
    checks.push("actual hydration renders synthetic first owner");

    const failed = hold();
    await focus();
    await bounded(failed.arrived, "background identity request");
    await expectOwner(players[0], false);
    await capture("pending-owner");
    failed.release({ status: 503 });
    assert.equal(await bounded(failed.done, "failed read delivery"), null);
    await page.waitForFunction(() => window.__sessionProbe.at(-1).state === "resolved");
    await settle();
    await expectOwner(players[0], false);
    checks.push("pending and failed background reads retain owner while hiding record");

    const changed = hold();
    await focus();
    await bounded(changed.arrived, "focus identity request");
    await expectOwner(players[0], false);
    current = players[1];
    changed.release({ player: current });
    assert.equal(await bounded(changed.done, "second owner delivery"), null);
    await expectOwner(players[1], true);
    assert(!(await page.locator("body").innerText()).includes(players[0].displayName));
    await capture("second-owner");
    checks.push("focus refresh replaces account and record link with second owner");

    const stale = hold();
    await focus();
    await bounded(stale.arrived, "stale identity request");
    await expectOwner(players[1], false);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.locator('input[name="email"]').waitFor();
    assert.equal(await record().count(), 0);
    stale.release({ player: current });
    const deliveryError = await bounded(stale.done, "stale read release");
    await page.waitForFunction(() => window.__sessionProbe.every(entry => entry.state !== "pending"));
    const staleState = await page.evaluate(() => window.__sessionProbe.at(-1).state);
    if (deliveryError) assert.equal(staleState, "aborted", deliveryError);
    await settle();
    assert.equal(await record().count(), 0);
    assert(!(await page.locator("body").innerText()).includes(players[1].displayName));
    await capture("after-stale-response");
    checks.push("released stale response cannot restore signed-out owner");

    const reads = await page.evaluate(() => window.__sessionProbe.length);
    await focus();
    await page.waitForFunction(count => window.__sessionProbe.length > count && window.__sessionProbe.at(-1).state === "resolved", reads);
    await settle();
    assert.equal(await record().count(), 0);
    assert(!(await page.locator("body").innerText()).includes(players[1].displayName));
    assert(requests.some(item => item.path === "/api/identity/sign-out" && item.method === "POST"));
    checks.push("retained synthetic hint cannot undo local sign-out on focus");
    assert.deepEqual(errors, []);
  } catch (error) {
    errors.push(String(error));
    await capture("failure").catch(() => {});
    throw error;
  } finally {
    for (const item of held) item.release({ player: null });
    await writeFile(new URL(`account-session-${engine}.json`, output), JSON.stringify({ candidate, checks, requests, errors,
      scope: "Actual hydrated candidate AccountProvider and AccountPanel with intercepted synthetic identity responses; no real sessions or server mutations" }, null, 2));
    await context.close();
  }
  console.log(`Verified ${checks.length} hydrated account-session checks`);
}
