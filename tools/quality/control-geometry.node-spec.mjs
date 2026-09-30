import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { geometryFailures } from "../control-geometry.mjs";
const button = { kind: "button", text: "fixture", height: 48, width: 140, radius: 12, fontSize: 16, lineHeight: 24, fontFamily: "fixture", fontWeight: "550", clipped: false };
const group = controls => [{ name: "real action row", controls }];
test("browser calibration awaits rendered mutation and keeps the real positive fail closed", () => {
  const source = readFileSync(new URL("../verify-control-geometry.mjs", import.meta.url), "utf8");
  const mutation = source.split("const calibrated = await page.evaluate(async () => {")[1]?.split('assert(calibrated, "Missing positive geometry control")')[0];
  assert(mutation);
  assert(mutation.indexOf('setProperty("-webkit-appearance"') < mutation.indexOf("requestAnimationFrame"));
  assert(mutation.indexOf("requestAnimationFrame") < mutation.indexOf("const style = getComputedStyle(control)"));
  assert.match(source, /assert\(calibrated.height <= 17,/);
  assert.match(source, /assert\(geometryFailures\(positive.groups, positive.expectedHeight\).length > 0,/);
  assert.match(mutation, /"min-block-size", "max-block-size"/);
  assert.match(mutation, /getPropertyPriority\(property\)/);
});
test("matching canonical controls and aligned Join input pass", () => assert.deepEqual(geometryFailures(group([button, { ...button }, { ...button, kind: "input", fontWeight: "400" }]), 48), []));
test("undersized button calibrates the detector", () => assert(geometryFailures(group([button, { ...button, height: 16 }]), 48).length));
test("radius, type and bounds mismatches are independently detected", () => {
  for (const change of [{ radius: 3 }, { fontSize: 12 }, { lineHeight: 19 }, { fontWeight: "400" }, { clipped: true }, { width: 0 }]) assert(geometryFailures(group([button, { ...button, ...change }]), 48).length);
});
test("one pixel rounding is allowed but Join height drift is rejected", () => {
  assert.deepEqual(geometryFailures(group([button, { ...button, height: 49, radius: 13 }]), 48), []);
  assert(geometryFailures(group([button, { ...button, kind: "input", height: 46 }]), 48).length);
});

test("intent actions allow wrapped text above canonical minimum without comparing type", () => {
  assert.deepEqual(geometryFailures([{ name: "intent choices", compareType: false, controls: [{ ...button, minimum: true, height: 72 }, { ...button, minimum: true, fontSize: 14 }] }], 48), []);
  assert(geometryFailures([{ name: "intent choices", compareType: false, controls: [{ ...button, minimum: true, height: 44 }] }], 48).length);
});
