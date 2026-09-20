import { observePerformanceTiming } from "./browser-evidence.mjs";

// Install before any navigation so every document, including a second tab,
// records the actual app-ready event consumed by waitForReady.
export async function prepareGameplayContext(context) {
  await context.addInitScript(observePerformanceTiming);
}

// Wait for the deployed readiness event before sending non-replayed keyboard input.
export async function waitForReady(page) {
  await page.waitForFunction(() => window.gtgPerformance?.readyMs != null, undefined, { timeout: 15_000 });
}

// Fresh contexts receive the real first-game guide after hydration.
export async function dismissFirstGuide(page) {
  const sheet = page.locator(".play-sheet");
  await sheet.waitFor({ state: "visible" });
  await sheet.locator(".play-sheet-bar button").click();
  await sheet.waitFor({ state: "hidden" });
}
