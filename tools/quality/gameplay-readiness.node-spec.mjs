import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { prepareGameplayContext, waitForReady } from "../gameplay-controls.mjs";

function documentFor(scripts) {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { readyState: "loading", fonts: { ready: Promise.resolve() } });
  const globals = { window, document, performance: { now: () => 42 }, PerformanceObserver: { supportedEntryTypes: [] }, requestAnimationFrame: () => {} };
  for (const script of scripts) runInNewContext(`(${script.toString()})()`, globals);
  const page = { waitForFunction: async predicate => {
    assert.equal(runInNewContext(`(${predicate.toString()})()`, globals), true, "actual readiness predicate remains false");
  } };
  return { page, ready: () => window.dispatchEvent(new Event("gtg:app-ready")) };
}

test("context readiness observes actual app events on first navigation and later tabs", async () => {
  const scripts = [];
  await prepareGameplayContext({ addInitScript: async script => { scripts.push(script); } });
  for (const label of ["first document", "second tab", "reload"]) {
    const view = documentFor(scripts);
    await assert.rejects(() => waitForReady(view.page), /predicate remains false/, label);
    view.ready();
    await waitForReady(view.page);
  }
  const missingObserver = documentFor([]);
  missingObserver.ready();
  await assert.rejects(() => waitForReady(missingObserver.page), /predicate remains false/, "An app event without the observer must not look ready");
});
