import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
export function settledBoardGeometry(probeId) {
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
  const current = measure();
  const previous = window.__gtgBoardProbe;
  const stable = current && previous?.id === probeId && previous.geometry?.renderer === current.renderer
    && ["x", "y", "width", "height", "rendererWidth", "rendererHeight"]
      .every(key => Math.abs(current[key] - previous.geometry[key]) < 1);
  const frames = stable ? previous.frames + 1 : 0;
  window.__gtgBoardProbe = { id: probeId, geometry: current, frames };
  // waitForFunction polls synchronously once per animation frame. Two matching
  // subsequent observations establish stability without a truthy Promise.
  return current && frames >= 2 ? current : null;
}

export async function waitForRenderedBoard(page) {
  const probeId = randomUUID();
  let handle;
  try {
    handle = await page.waitForFunction(settledBoardGeometry, probeId, { timeout: 15_000, polling: "raf" });
    const geometry = await handle.jsonValue();
    assert(geometry && ["canvas", "svg"].includes(geometry.renderer), "Rendered board geometry is missing");
    assert(["width", "height", "rendererWidth", "rendererHeight"].every(key => Number.isFinite(geometry[key]) && geometry[key] > 0), "Rendered board bounds must be positive");
    assert(Number.isFinite(geometry.x) && Number.isFinite(geometry.y), "Rendered board position is invalid");
    return geometry;
  } finally {
    await handle?.dispose();
    await page.evaluate(id => { if (window.__gtgBoardProbe?.id === id) delete window.__gtgBoardProbe; }, probeId);
  }
}
