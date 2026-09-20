import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { settledBoardGeometry } from "../gameplay-controls.mjs";

async function measure({ absent = false, empty = false, zero = false, hidden = false, moving = false, renderer = "canvas" } = {}) {
  let frame = 0;
  const box = { x: 0, y: 100, width: 320, height: zero ? 0 : 320 };
  const board = { parentElement: null, getBoundingClientRect: () => ({ ...box, y: box.y + (moving ? frame : 0) }) };
  const drawing = { tagName: renderer.toUpperCase(), width: 320, height: 320, parentElement: board, getBoundingClientRect: () => box };
  board.querySelectorAll = () => empty ? [] : [drawing];
  const globals = { document: { querySelectorAll: () => absent ? [] : [board] },
    getComputedStyle: () => ({ display: "block", visibility: hidden ? "hidden" : "visible", opacity: "1" }),
    requestAnimationFrame: callback => { frame++; callback(); } };
  return runInNewContext(`(${settledBoardGeometry.toString()})()`, globals);
}

test("rendered-board detector requires visible renderer and settled nonzero bounds", async () => {
  for (const renderer of ["canvas", "svg"]) assert.equal((await measure({ renderer })).renderer, renderer);
  for (const missing of [{ absent: true }, { empty: true }, { zero: true }, { hidden: true }, { moving: true }]) {
    assert.equal(await measure(missing), null, JSON.stringify(missing));
  }
});
