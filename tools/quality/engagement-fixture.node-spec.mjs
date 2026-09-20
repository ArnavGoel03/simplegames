import assert from "node:assert/strict";
import { test } from "node:test";
import { fixtureId, syntheticState } from "../engagement-fixture.mjs";

function fixture() {
  const metadata = { soloPath: "/api/solo-progress", soloHeader: "x-solo-player" };
  const state = syntheticState(metadata, [{ site: "cards", origin: "https://cards.test" }]);
  const call = (owner, body) => state.answer({ path: metadata.soloPath, method: "PUT", headers: { [metadata.soloHeader]: owner }, body });
  return { state, call };
}
const data = value => ({ save: { moves: value }, record: null });
test("synthetic CAS conflict cannot overwrite the remote head", () => {
  const { state, call } = fixture(), owner = fixtureId(1);
  state.set(owner, "freecell", data(3), 2);
  const result = call(owner, { slot: "freecell", baseRevision: 1, data: data(1) });
  assert.equal(result.status, 409);
  assert.deepEqual(result.json.snapshot.data, data(3));
  assert.deepEqual(result.json.snapshot.conflicts[0].data, data(1));
});
test("synthetic identity switching rejects old-owner writes before recording them", () => {
  const { state, call } = fixture(); state.current = state.players[1];
  assert.equal(call(fixtureId(1), { slot: "freecell", baseRevision: 0, data: data(1) }).status, 401);
  assert.equal(state.writes.length, 0);
  assert.equal(state.get(fixtureId(2), "freecell").revision, 0);
});
test("explicit conflict resolution removes only named branches", () => {
  const { state, call } = fixture(), owner = fixtureId(1);
  state.set(owner, "freecell", data(3), 2);
  const first = call(owner, { slot: "freecell", baseRevision: 1, data: data(1) });
  const result = call(owner, { slot: "freecell", baseRevision: 2, data: data(3), resolve: [first.json.conflictId] });
  assert.equal(result.outcome, "saved"); assert.equal(result.snapshot.revision, 3);
  assert.deepEqual(result.snapshot.conflicts, []);
});
test("unhandled synthetic APIs refuse access instead of reaching production", () => {
  const { state } = fixture();
  assert.deepEqual(state.answer({ path: "/api/identity/sign-up", method: "POST" }), { status: 404, json: {} });
});
