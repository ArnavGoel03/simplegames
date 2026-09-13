import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import catalogue from "../src/lib/game-catalogue.json" with { type: "json" };

const output = new URL("../.audit/visual/", import.meta.url);
await mkdir(output, { recursive: true });
const live = process.argv.includes("--live");
const local = "http://127.0.0.1:3187";
const sites = live
  ? [{ id: "studio", url: "https://glasstablegames.com" }, ...catalogue.sites]
  : [{ id: "studio", url: local }];
const sizes = [[320, 720], [390, 844], [844, 390], [1024, 768], [1440, 1000], [2560, 1440]];
const results = [];
let server;
let browser;

try {
  if (!live) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3187"], { stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Preview did not become ready in 30 seconds")), 30_000);
      const ready = (data) => {
        process.stdout.write(data);
        if (data.toString().includes("Ready in")) { clearTimeout(timeout); resolve(); }
      };
      server.stdout.on("data", ready);
      server.stderr.on("data", data => process.stderr.write(data));
      server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
      server.once("error", error => { clearTimeout(timeout); reject(error); });
    });
  }
  browser = await chromium.launch();
  for (const site of sites) {
    const url = new URL(site.url);
    if (!(url.origin === local || (url.protocol === "https:" && (url.hostname === "glasstablegames.com" || url.hostname.endsWith(".glasstablegames.com"))))) {
      throw new Error(`Unexpected visual target: ${url.origin}`);
    }
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({ colorScheme, reducedMotion: "reduce", viewport: { width: sizes[0][0], height: sizes[0][1] } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
      if (!response?.ok()) throw new Error(`${url.href}: HTTP ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(async () => {
        for (const image of document.images) image.loading = "eager";
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
      });
      // Calibrate the overflow detector against a known oversized element.
      const detectsOverflow = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.cssText = "position:absolute;left:0;top:0;width:200vw;height:1px";
        document.body.append(probe);
        const detected = document.documentElement.scrollWidth > innerWidth + 1;
        probe.remove();
        return detected;
      });
      if (!detectsOverflow) throw new Error("Overflow detector failed positive calibration");
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          images: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc),
          title: document.title,
          background: getComputedStyle(document.body).backgroundColor,
          heading: document.querySelector("h1")?.textContent,
        }));
        const name = `${site.id}-${colorScheme}-${width}x${height}`;
        await page.screenshot({ path: new URL(`${name}.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 80 });
        results.push({ name, url: url.href, ...state, errors: [...errors] });
        console.log(JSON.stringify(results.at(-1)));
      }
      if (site.id === "studio") {
        await page.emulateMedia({ contrast: "more" });
        await page.screenshot({ path: new URL(`studio-${colorScheme}-contrast.jpg`, output).pathname, fullPage: true, type: "jpeg", quality: 80 });
      }
      await context.close();
    }
  }
  if (results.some(result => result.overflow || result.images.length || result.errors.length)) {
    throw new Error("Visual checks found overflow, failed images or runtime errors");
  }
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify(results, null, 2));
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolve => {
      const timeout = setTimeout(() => { server.kill("SIGKILL"); resolve(); }, 5_000);
      server.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
  }
}
