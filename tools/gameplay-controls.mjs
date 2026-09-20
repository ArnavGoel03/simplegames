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

// App readiness does not imply that a dynamically imported game renderer exists.
export async function settledBoardGeometry() {
  const measure = () => {
    const visible = element => {
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return false;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    for (const board of document.querySelectorAll(".play-board-fit")) {
      if (!visible(board)) continue;
      const renderer = [...board.querySelectorAll("svg,canvas")].find(element => visible(element)
        && (element.tagName.toLowerCase() !== "canvas" || (element.width > 0 && element.height > 0)));
      if (!renderer) continue;
      const box = board.getBoundingClientRect(), drawn = renderer.getBoundingClientRect();
      return { renderer: renderer.tagName.toLowerCase(), x: box.x, y: box.y, width: box.width, height: box.height,
        rendererWidth: drawn.width, rendererHeight: drawn.height };
    }
    return null;
  };
  const before = measure();
  if (!before) return null;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const after = measure();
  return after && after.renderer === before.renderer && ["x", "y", "width", "height", "rendererWidth", "rendererHeight"]
    .every(key => Math.abs(after[key] - before[key]) < 1) ? after : null;
}

export async function waitForRenderedBoard(page) {
  const geometry = await page.waitForFunction(settledBoardGeometry, undefined, { timeout: 15_000 });
  try { return await geometry.jsonValue(); } finally { await geometry.dispose(); }
}
