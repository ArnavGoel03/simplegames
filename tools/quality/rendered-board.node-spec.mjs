import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { waitForRenderedBoard } from "../gameplay-controls.mjs";

function pageFor({ absent = false, empty = false, zero = false, hidden = false, moving = false, renderer = "canvas", appearsAt = 0, falseHandle = false } = {}) {
  let frame = 0, disposed = false;
  const box = { x: 0, y: 100, width: 320, height: zero ? 0 : 320 };
  const board = { parentElement: null, getBoundingClientRect: () => ({ ...box, y: box.y + (moving ? frame * 2 : 0) }) };
  const drawing = { tagName: renderer.toUpperCase(), width: 320, height: 320, parentElement: board, getBoundingClientRect: () => box };
  board.querySelectorAll = () => empty ? [] : [drawing];
  const globals = { window: {}, document: { querySelectorAll: () => absent || frame < appearsAt ? [] : [board] },
    getComputedStyle: () => ({ display: "block", visibility: hidden ? "hidden" : "visible", opacity: "1" }) };
  const page = {
    waitForFunction: async (predicate, id, options) => {
      assert.equal(options.timeout, 15_000); assert.equal(options.polling, "raf");
      for (; frame < 8; frame++) {
        const value = runInNewContext(`(${predicate.toString()})(id)`, { ...globals, id });
        assert(!value?.then, "The actual polling predicate must be synchronous");
        if (value || falseHandle) return { jsonValue: async () => falseHandle ? null : value, dispose: async () => { disposed = true; } };
      }
      throw new Error("render polling exhausted");
    },
    evaluate: async (callback, id) => runInNewContext(`(${callback.toString()})(id)`, { ...globals, id }),
  };
  return { page, frame: () => frame, disposed: () => disposed, probe: () => globals.window.__gtgBoardProbe };
}

test("actual board waiter polls delayed renderer synchronously until stable and returns geometry", async () => {
  for (const renderer of ["canvas", "svg"]) {
    const view = pageFor({ renderer, appearsAt: 2 });
    const geometry = await waitForRenderedBoard(view.page);
    assert.equal(geometry.renderer, renderer); assert.equal(geometry.width, 320);
    assert.equal(view.frame(), 4); assert.equal(view.disposed(), true); assert.equal(view.probe(), undefined);
  }
});

test("actual board waiter rejects missing, hidden, empty, zero, moving and null-handle false positives", async () => {
  for (const missing of [{ absent: true }, { empty: true }, { zero: true }, { hidden: true }, { moving: true }]) {
    const view = pageFor(missing);
    await assert.rejects(() => waitForRenderedBoard(view.page), /render polling exhausted/);
    assert.equal(view.probe(), undefined);
  }
  const falsePositive = pageFor({ falseHandle: true });
  await assert.rejects(() => waitForRenderedBoard(falsePositive.page), /geometry is missing/);
  assert.equal(falsePositive.disposed(), true);
});


test("installed Playwright poller stops on a Promise but polls synchronous null until geometry", async () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(join(dirname(require.resolve("playwright-core/package.json")), "lib/coreBundle.js"), "utf8");
  const predicateAt = source.indexOf("const success = predicate();");
  const start = source.lastIndexOf("let fulfill;", predicateAt);
  const end = source.indexOf("\n          }, { expression:", predicateAt);
  assert(predicateAt > 0 && start > 0 && end > start, "Installed Playwright polling implementation changed; review this calibration");
  const body = source.slice(start, end);
  const poll = predicate => {
    const frames = [];
    const control = runInNewContext(`(function(){${body}})()`, { predicate, polling: undefined,
      injected: { utils: { builtins: { requestAnimationFrame: callback => frames.push(callback) } } } });
    return { control, frames };
  };
  const originalBug = poll(async () => null);
  assert.equal(await originalBug.control.result, null);
  assert.equal(originalBug.frames.length, 0, "A truthy Promise prevents another browser poll");
  let calls = 0;
  const corrected = poll(() => ++calls < 3 ? null : { renderer: "canvas", width: 320, height: 320 });
  assert.equal(corrected.frames.length, 1);
  corrected.frames.shift()(); corrected.frames.shift()();
  assert.equal((await corrected.control.result).renderer, "canvas");
  assert.equal(calls, 3);
});
