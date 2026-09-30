import assert from "node:assert/strict";
import test from "node:test";
import { geometryFailures } from "../control-geometry.mjs";
const button = { kind: "button", text: "fixture", height: 48, width: 140, radius: 12, fontSize: 16, lineHeight: 24, fontFamily: "fixture", fontWeight: "550", clipped: false };
const group = controls => [{ name: "real action row", controls }];
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
