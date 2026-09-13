import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import sharp from "sharp";
import { candidates, engine, observeSource, output } from "./browser-evidence.mjs";

// Diagnostic captures only. This script never writes release-evidence.json.
const candidate = candidates.find(item => item.site === "teenpatti");
const directory = new URL(`wheel-probe-${engine}/`, output);
const sizes = [[320, 720], [390, 844], [844, 390], [1024, 768], [1440, 1000], [2560, 1440]];
const tile = '.casino-floor-game[data-game="prize-wheel"]';
const variants = [
  { id: "baseline", css: "" },
  { id: "no-filter", css: `${tile} .casino-wheel { filter: none !important; }` },
  { id: "wheel-overflow-visible", css: `${tile} .casino-wheel { overflow: visible !important; }` },
  { id: "no-rotate-x", css: `${tile} .casino-wheel { transform: rotateZ(-12deg) !important; }` },
];
const report = { schema: 1, purpose: "wheel paint investigation", engine, candidate, scenarios: [] };
let browser;
let deadline;

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function measure(page) {
  return page.evaluate(() => {
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        documentX: rect.x + scrollX, documentY: rect.y + scrollY };
    };
    const describe = (element, pseudo) => {
      if (!element) return null;
      const style = getComputedStyle(element, pseudo);
      const properties = ["display", "visibility", "opacity", "position", "z-index", "width", "height",
        "overflow", "overflow-x", "overflow-y", "clip-path", "contain", "content-visibility", "isolation",
        "filter", "backdrop-filter", "transform", "transform-origin", "transform-style", "perspective",
        "backface-visibility", "will-change", "background-color", "animation-name", "transition-property"];
      return { element: element.tagName, className: element.getAttribute("class"), pseudo,
        bounds: bounds(element), style: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])) };
    };
    const wheels = ["prize-wheel", "roulette"].map(game => {
      const card = document.querySelector(`.casino-floor-game[data-game="${game}"]`);
      const art = card?.querySelector(".casino-floor-art");
      const wheel = art?.querySelector(".casino-wheel");
      const svg = wheel?.querySelector("svg");
      return { game, card: describe(card), art: describe(art), glow: describe(art, "::before"),
        wheel: describe(wheel), svg: describe(svg),
        svgPaths: svg?.querySelectorAll("path").length,
        paintReferences: [...(svg?.querySelectorAll('[fill^="url("]') ?? [])].map(element => {
          const fill = element.getAttribute("fill");
          const id = /^url\(#(.+)\)$/.exec(fill)?.[1];
          return { fill, targetExists: Boolean(id && document.getElementById(id)), computedFill: getComputedStyle(element).fill };
        }),
      };
    });
    return { viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, scroll: { x: scrollX, y: scrollY },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      readyState: document.readyState, fonts: document.fonts.status,
      stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ path: new URL(link.href).pathname, loaded: Boolean(link.sheet) })),
      cards: [...document.querySelectorAll(".casino-floor-game")].map(element => ({ game: element.dataset.game, bounds: bounds(element), art: bounds(element.querySelector(".casino-floor-art")) })),
      wheels };
  });
}

function cropBounds(rect, metadata) {
  const left = Math.max(0, Math.floor(rect.documentX));
  const top = Math.max(0, Math.floor(rect.documentY));
  const width = Math.min(metadata.width - left, Math.ceil(rect.documentX + rect.width) - left);
  const height = Math.min(metadata.height - top, Math.ceil(rect.documentY + rect.height) - top);
  assert(width > 0 && height > 0, "Wheel crop must lie inside the captured document");
  return { left, top, width, height };
}

async function saveCapture(page, label, { montage = false, viewport = false } = {}) {
  const before = await measure(page);
  assert.equal(before.cards.length, 11, "Probe requires all eleven gallery cards");
  // Locator screenshots scroll first and could hide a paint failure. Crop a
  // full-page capture instead, just like the release run, until testing scroll.
  const screenshot = await page.screenshot({ fullPage: !viewport, type: "jpeg", quality: 80, timeout: 10_000 });
  const after = await measure(page);
  const metadata = await sharp(screenshot).metadata();
  assert.equal(before.viewport.devicePixelRatio, 1, "Probe crop coordinates require CSS pixels");
  const images = [];
  for (const wheel of before.wheels) {
    const rect = wheel.card.bounds;
    if (viewport && (rect.y < 0 || rect.y + rect.height > before.viewport.height)) {
      assert.notEqual(wheel.game, "prize-wheel", "Scrolled Prize Wheel must fit inside the viewport");
      images.push({ game: wheel.game, skipped: "control outside viewport" });
      continue;
    }
    const file = `${label}-${wheel.game}.jpg`;
    const crop = viewport ? { ...rect, documentX: rect.x, documentY: rect.y } : rect;
    const bytes = await sharp(screenshot).extract(cropBounds(crop, metadata))
      .resize({ width: 320, withoutEnlargement: true }).jpeg({ quality: 68 }).toBuffer();
    await writeFile(new URL(file, directory), bytes);
    images.push({ file, bytes: bytes.length });
  }
  if (montage) {
    const cells = await Promise.all(before.cards.map(async (card, index) => ({
      input: await sharp(screenshot).extract(cropBounds(card.bounds, metadata))
        .resize(128, 112, { fit: "contain", background: "#171923" }).png().toBuffer(),
      left: index % 4 * 128, top: Math.floor(index / 4) * 112,
    })));
    const file = `${label}-all-games.jpg`;
    const bytes = await sharp({ create: { width: 512, height: 336, channels: 3, background: "#171923" } })
      .composite(cells).jpeg({ quality: 65 }).toBuffer();
    await writeFile(new URL(file, directory), bytes);
    images.push({ file, bytes: bytes.length });
  }
  return { label, kind: viewport ? "viewport" : "fullPage", before, after,
    screenshot: { width: metadata.width, height: metadata.height }, images };
}

async function scenario(variant) {
  const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce", deviceScaleFactor: 1,
    viewport: { width: sizes[0][0], height: sizes[0][1] } });
  const entry = { id: variant.id, css: variant.css, errors: [], failedRequests: [], captures: [] };
  report.scenarios.push(entry);
  let page;
  try {
    page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(20_000);
    page.on("pageerror", error => { if (entry.errors.length < 30) entry.errors.push(error.message.slice(0, 500)); });
    page.on("requestfailed", request => {
      if (entry.failedRequests.length < 30) entry.failedRequests.push({ path: new URL(request.url()).pathname,
        resource: request.resourceType(), error: request.failure()?.errorText });
    });
    const response = await page.goto(candidate.origin, { waitUntil: "domcontentloaded" });
    assert(response?.ok(), `Candidate document failed: ${response?.status()}`);
    assert.equal(new URL(page.url()).origin, candidate.origin, "Candidate navigation changed origin");
    await page.waitForFunction(() => document.fonts.status === "loaded"
      && document.querySelectorAll(".casino-floor-game").length === 11
      && getComputedStyle(document.querySelector(".casino-floor-games")).display === "grid"
      && [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => Boolean(link.sheet)));
    entry.observedSourceHead = await observeSource(page, "teenpatti");
    // Match the release harness's temporary overflow calibration before resize.
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:0;top:0;width:200vw;height:1px";
      document.body.append(probe);
      void document.documentElement.scrollWidth;
      probe.remove();
    });
    // Each variant gets a fresh document and repeats the complete resize and
    // screenshot sequence. Earlier scrolling or style changes cannot repair it.
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await settle(page);
      if (variant.id === "baseline") {
        entry.captures.push(await saveCapture(page, `${variant.id}-${width}x${height}`, { montage: true }));
      } else if (width === sizes.at(-1)[0]) {
        entry.captures.push(await saveCapture(page, `${variant.id}-before`));
      } else {
        await page.screenshot({ fullPage: true, type: "jpeg", quality: 80, timeout: 10_000 });
      }
      console.log(`wheel probe: ${variant.id} ${width}x${height}`);
    }
    if (variant.css) {
      await page.addStyleTag({ content: variant.css });
      await settle(page);
      entry.captures.push(await saveCapture(page, `${variant.id}-after-style`));
    }
    await page.locator(tile).scrollIntoViewIfNeeded();
    await settle(page);
    entry.captures.push(await saveCapture(page, `${variant.id}-after-scroll`, { viewport: true }));
    if (variant.id === "baseline") {
      // Known missing-art reference for interpreting the screenshots. This is
      // temporary test-page CSS and cannot change the deployed product.
      await page.addStyleTag({ content: `${tile} .casino-wheel { visibility: hidden !important; }` });
      await settle(page);
      entry.captures.push(await saveCapture(page, "baseline-known-hidden", { viewport: true }));
    }
  } catch (error) {
    entry.failure = error.message;
    if (page) entry.lastState = await measure(page).catch(() => null);
    throw error;
  } finally {
    await context.close();
  }
}

if (!candidate) {
  console.log("wheel probe: skipped, no Casino candidate receipt supplied");
} else {
  await mkdir(directory, { recursive: true });
  try {
    browser = await ({ chromium, webkit })[engine].launch({ timeout: 15_000 });
    deadline = setTimeout(() => {
      report.failure = "Wheel probe exceeded its 150 second budget";
      void browser.close();
    }, 150_000);
    for (const variant of variants) await scenario(variant);
    assert(!report.failure, report.failure);
    report.completed = true;
  } catch (error) {
    report.failure ??= error.stack ?? String(error);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    await browser?.close();
    await writeFile(new URL("report.json", directory), JSON.stringify(report));
  }
  console.log(`wheel probe: ${report.completed ? "captured" : "failed"}, ${directory.pathname}`);
}
