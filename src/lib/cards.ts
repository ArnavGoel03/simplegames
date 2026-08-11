// The deck the card game deals from, and the deal itself.
//
// A second mirror, of packages/cards/src/{deck,rounds,deal}.ts in the Chaupal
// repository, and it carries the same warning src/lib/fairness.ts does: the
// home page deals a hand and says it is the hand the real table would deal, so
// if the deck order or the dealing pattern over there changes and this file
// does not, the page is lying.
//
// The parts of those files that matter to a demonstration are here and no
// more. Bidding, tricks and scoring are the game, not the derivation, and they
// live where the game is played.

import { shuffleIndices } from "./fairness";

/**
 * FROZEN, both of these, and in this order.
 *
 * The shuffle permutes indices into DECK, so reordering either list changes
 * which card a given seed deals, and every recorded game becomes uncheckable.
 */
export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

/** Ace high, which is what every trick-taking game in this family plays. */
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** Canonical deck order: each suit in turn, low to high within it. */
export const DECK: readonly Card[] = SUITS.flatMap((suit) =>
  RANKS.map((rank): Card => ({ suit, rank })),
);

/** Thirteen deals, ascending, ending with the whole deck dealt out. */
export const TOTAL_ROUNDS = 13;

/** Round n deals n cards to each player. */
export function cardsInRound(round: number): number {
  return round;
}

/**
 * Trump rotates rather than being cut for, so the trump of any round is a
 * function of the round number alone and a verifier never has to trust a
 * recorded value.
 */
export const TRUMP_ROTATION: readonly Suit[] = ["spades", "diamonds", "clubs", "hearts"];

export function trumpForRound(round: number): Suit {
  return TRUMP_ROTATION[(round - 1) % TRUMP_ROTATION.length];
}

/**
 * The hands for one round, reproducible from the seed and the round number.
 *
 * The round number is the shuffle nonce, so every round of a match is an
 * independent deal while the whole match still verifies from the single seed
 * revealed at the end. Cards go out one at a time around the table rather than
 * as a contiguous slice per seat, because that is how a deal is done at a real
 * table and it keeps a transcript legible to somebody checking it by hand.
 */
export async function dealRound(
  seed: Uint8Array,
  round: number,
  seats: number,
  cardsEach: number,
): Promise<Card[][]> {
  const needed = seats * cardsEach;
  if (needed > DECK.length) {
    throw new Error(
      `dealRound: ${seats} seats of ${cardsEach} needs ${needed} cards, the deck holds ${DECK.length}`,
    );
  }
  const order = await shuffleIndices(seed, round, DECK.length);
  const hands: Card[][] = Array.from({ length: seats }, () => []);
  for (let dealt = 0; dealt < needed; dealt++) {
    hands[dealt % seats].push(DECK[order[dealt]]);
  }
  return hands;
}

// ---------- display ----------
//
// Glyphs rather than the two character ids the wire protocol carries. An id
// like "ts" is precise and unreadable; a reader checking that a hand looks
// like a hand should not have to decode it first.

const RANK_LABEL: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export const SUIT_LABEL: Record<Suit, string> = {
  spades: "spades",
  hearts: "hearts",
  diamonds: "diamonds",
  clubs: "clubs",
};

export function rankLabel(card: Card): string {
  return RANK_LABEL[card.rank];
}

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPH[suit];
}

/** Hearts and diamonds are red on a real card, and a reader expects that. */
export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

/** Spoken, for anyone who is hearing the page rather than looking at it. */
export function cardName(card: Card): string {
  return `${RANK_LABEL[card.rank]} of ${SUIT_LABEL[card.suit]}`;
}
