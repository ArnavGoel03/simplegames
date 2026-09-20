import assert from "node:assert/strict";

export const fixtureId = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const fixtureGame = "00000000-0000-4000-8001-000000000001";
export const emptySlot = slot => ({ slot, revision: 0, updatedAt: null, data: null, conflicts: [] });
export const snapshot = (slot, data, revision = 1) => ({ slot, revision, data, updatedAt: "2026-09-20T10:00:00Z", conflicts: [] });
export function syntheticState(fixture, candidates) {
  const players = ["rook", "bishop", "knight"].map((name, i) => ({ id: fixtureId(i + 1), kind: "registered", handle: `fixture-${name}`,
    displayName: `Fixture ${name}`, avatarSeed: `fixture-${name}`, countryCode: null, createdAt: "2026-09-20T10:00:00Z" }));
  const heads = new Map();
  const offers = [{ id: fixtureId(20), fromPlayerId: players[1].id, toPlayerId: players[0].id, displayName: players[1].displayName,
    game: "rummy", site: "cards", roomId: "fixture-inbox-42", status: "pending", expiresAt: "2099-01-01T00:00:00Z" }];
  const friends = new Map([[players[1].id, { friendship: "pending", outgoing: false }]]);
  const state = { players, current: players[0], heads, offers, friends, requests: [], writes: [], soloOffline: false, refuseCreate: false };
  const slots = ["daily", "freecell", "klondike", "spider"];
  const key = (owner, slot) => `${owner}:${slot}`;
  state.set = (owner, slot, data, revision = 1) => heads.set(key(owner, slot), snapshot(slot, data, revision));
  state.get = (owner, slot) => heads.get(key(owner, slot)) ?? emptySlot(slot);
  state.answer = ({ path, method, headers = {}, body, query = new URLSearchParams() }) => {
    state.requests.push({ path, method });
    assert(state.requests.length < 300, "Synthetic API request loop");
    const owner = state.current.id;
    if (path === "/api/identity/me") return { player: state.current };
    if (path === "/api/player-progress") return { playerId: owner, games: owner === players[0].id ? 60 : 4, wins: owner === players[0].id ? 32 : 1, gameKinds: owner === players[0].id ? 5 : 1 };
    if (path === fixture.soloPath) {
      if (headers[fixture.soloHeader] !== owner) return { status: 401, json: { error: "sign in first" } };
      if (method === "GET") return { playerId: owner, slots: (query.has("slot") ? [query.get("slot")] : slots).map(slot => state.get(owner, slot)) };
      assert.equal(method, "PUT");
      state.writes.push({ owner, body: structuredClone(body) });
      const held = state.get(owner, body.slot);
      if (body.baseRevision !== held.revision) {
        const conflictId = fixtureId(30 + held.conflicts.length);
        const next = { ...held, conflicts: [...held.conflicts, { id: conflictId, baseRevision: body.baseRevision, createdAt: "2026-09-20T10:00:00Z", data: body.data }] };
        heads.set(key(owner, body.slot), next);
        return { status: 409, json: { playerId: owner, outcome: "conflict", snapshot: next, conflictId } };
      }
      const next = { ...snapshot(body.slot, body.data, held.revision + 1), conflicts: held.conflicts.filter(row => !(body.resolve ?? []).includes(row.id)) };
      heads.set(key(owner, body.slot), next);
      return { playerId: owner, outcome: "saved", snapshot: next };
    }
    if (path === "/api/friends") {
      if (method === "POST") {
        assert.equal(body.viewerId, owner);
        friends.set(body.playerId, { friendship: body.action === "accept" ? "accepted" : "pending", outgoing: body.action !== "accept" });
      }
      return { friends: [] };
    }
    if (path === "/api/rivals") return { viewerId: owner, next: null, rivals: players.filter(player => player.id !== owner).map((player) => ({
      playerId: player.id, displayName: player.displayName, handle: player.handle, avatarSeed: player.avatarSeed,
      wins: 7, losses: 5, draws: 1, played: 13, lastPlayedAt: "2026-09-20T10:00:00.000000Z", gameId: fixtureGame, game: "rummy",
      ...(friends.get(player.id) ?? { friendship: null, outgoing: false }),
    })) };
    if (path === "/api/rematches") {
      if (method === "GET") return { viewerId: owner, invitations: offers.filter(row => row.status === "pending" || row.status === "accepted") };
      assert.equal(body.viewerId, owner);
      if (state.refuseCreate && body.action === "create") return { status: 404, json: { error: "no player goes by that name" } };
      if (body.action === "create") {
        assert.equal(body.gameId, fixtureGame); assert.equal(friends.get(body.playerId)?.friendship, "accepted");
        const invitation = { id: fixtureId(21), fromPlayerId: owner, toPlayerId: body.playerId, displayName: players.find(player => player.id === body.playerId).displayName,
          game: "rummy", site: "cards", roomId: "fixture-rematch-42", status: "pending", expiresAt: "2099-01-01T00:00:00Z" };
        offers.push(invitation);
        return { viewerId: owner, invitation, url: `${candidates.find(row => row.site === "cards").origin}/r/${invitation.roomId}?g=rummy` };
      }
      const invitation = offers.find(row => row.id === body.id);
      assert(invitation, "Synthetic action references an unknown invite");
      invitation.status = body.action === "accept" ? "accepted" : body.action === "decline" ? "declined" : body.action === "cancel" ? "cancelled" : invitation.status;
      return { viewerId: owner, invitations: offers.filter(row => ["pending", "accepted"].includes(row.status)),
        url: ["accept", "open"].includes(body.action) ? `${candidates.find(row => row.site === "cards").origin}/r/${invitation.roomId}?g=rummy` : null };
    }
    return { status: 404, json: {} };
  };
  return state;
}

export function assertRestoredWrites(writes, owner, slot, restored) {
  for (const write of writes.filter(row => row.owner === owner && row.body.slot === slot)) {
    const save = write.body.data?.save;
    assert(save, "A restored game must not be replaced by an empty save");
    assert.equal(save.attemptId, restored.attemptId, "Autosave changed the restored attempt");
    assert.deepEqual(save.deal, restored.deal, "Autosave replaced the restored deal");
    assert(Array.isArray(save.steps) && save.steps.length >= restored.steps.length, "Autosave lost restored moves");
    assert.deepEqual(save.steps.slice(0, restored.steps.length), restored.steps, "Autosave rewrote restored moves");
  }
}

export async function attemptScenario(label, run, onFailure, errors) {
  try { await run(); return true; }
  catch (error) {
    errors.push(`${label}: ${String(error)}`);
    await onFailure();
    return false;
  }
}
