// The mirror check.
//
// src/lib/fairness.ts and src/lib/cards.ts are hand copies of code that lives
// in the Chaupal repository, and the home page tells a reader that what it
// just ran is the code the games run. If the copy drifts, the page lies, and
// that is the worst failure this site can have. It used to be guarded by
// "check the pair by eye at every release", which is not a guard.
//
// So the real implementation was run over fixed seeds and its answers written
// down in __vectors__/derivation.json. These tests replay them here. A drift
// in this repo now fails a test rather than shipping.
//
// What this catches and what it does not: it catches THIS file's copy changing
// or being edited wrongly. It does not catch the Chaupal side changing, which
// would leave these vectors stale and passing. Regenerate them whenever the
// Chaupal derivation moves, and read __vectors__/README.md before you do. The
// real fix is still one shared package, and this is the guard until then.

import { describe, expect, it } from "vitest";
import vectors from "./__vectors__/derivation.json";
import { bytesToHex, rollDie, shuffleIndices } from "./fairness";
import { DECK, dealRound, rankLabel, type Card } from "./cards";

/** The two character ids the wire protocol carries, which is what the vectors record. */
const SUIT_CHAR = { spades: "s", hearts: "h", diamonds: "d", clubs: "c" } as const;

function idOf(card: Card): string {
  const rank = rankLabel(card);
  return `${rank === "10" ? "t" : rank.toLowerCase()}${SUIT_CHAR[card.suit]}`;
}

function seedFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

describe("the deck", () => {
  it("is in the order the shuffle permutes into", () => {
    expect(DECK.map(idOf)).toEqual(vectors.deck);
  });

  it("holds 52 distinct cards", () => {
    expect(new Set(DECK.map(idOf)).size).toBe(52);
  });
});

describe.each(vectors.cases)("seed $seed", (vector) => {
  const seed = seedFromHex(vector.seed);

  it("round trips to the hex it was written down as", () => {
    expect(bytesToHex(seed)).toBe(vector.seed);
  });

  it("rolls the faces the games roll", async () => {
    const rolls: number[] = [];
    for (let index = 0; index < vector.rolls.length; index++) {
      rolls.push(await rollDie(seed, index));
    }
    expect(rolls).toEqual(vector.rolls);
  });

  it("shuffles into the order the games shuffle into", async () => {
    for (const [round, order] of Object.entries(vector.shuffles)) {
      expect(await shuffleIndices(seed, Number(round), DECK.length)).toEqual(order);
    }
  });

  it("deals the hands the table deals", async () => {
    const hands = await dealRound(seed, 5, 4, 5);
    expect(hands.map((hand) => hand.map(idOf))).toEqual(vector.round5FourSeats);
  });
});

describe("the shuffle is a shuffle", () => {
  it("returns a permutation, not a sample", async () => {
    const order = await shuffleIndices(seedFromHex(vectors.cases[0].seed), 7, 52);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it("gives each round of a match a different deal", async () => {
    const seed = seedFromHex(vectors.cases[0].seed);
    const first = (await shuffleIndices(seed, 1, 52)).join();
    const second = (await shuffleIndices(seed, 2, 52)).join();
    expect(first).not.toBe(second);
  });

  it("is stable: the same seed and round always deal the same cards", async () => {
    const seed = seedFromHex(vectors.cases[1].seed);
    expect(await shuffleIndices(seed, 4, 52)).toEqual(await shuffleIndices(seed, 4, 52));
  });

  it("refuses a count that is not a whole number of cards", async () => {
    await expect(shuffleIndices(new Uint8Array(32), 1, -1)).rejects.toThrow();
  });

  it("will not deal more cards than the deck holds", async () => {
    await expect(dealRound(new Uint8Array(32), 13, 4, 14)).rejects.toThrow();
  });
});
