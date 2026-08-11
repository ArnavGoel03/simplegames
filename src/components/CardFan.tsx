import type { CSSProperties } from "react";
import {
  cardName,
  cardsInRound,
  dealRound,
  isRedSuit,
  rankLabel,
  SUIT_LABEL,
  suitGlyph,
  trumpForRound,
} from "@/lib/cards";

// Judgement's key art.
//
// The other games are photographed, because a board is a public object and a
// screenshot of one is just a picture of what the players are looking at. A
// card game has no such object: the table is the hands, and the hands are
// private. So this is dealt rather than photographed, by the same function the
// real table deals with, from a seed written down below.
//
// That makes it a true picture of the game in the only sense available: these
// seven cards are exactly what seat one is dealt in round seven from this seed,
// and anybody who disbelieves it can run the same sum.

/** Round seven, because seven cards fan well and a hand of one does not. */
const ART_ROUND = 7;
const ART_SEATS = 4;

/**
 * A fixed display seed, so the art is identical on every build.
 *
 * It is written into the source on purpose. A real game's seed is secret until
 * the game ends, and publishing this one is exactly why it must never be used
 * to deal a real hand: the point of the ceremony is that nobody, including us,
 * knows the seed while the cards still matter.
 */
const ART_SEED = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);

/**
 * How far the fan opens, and how far the outer cards ride away from the pivot.
 * The lift is negative because the pivot is below the hand, so moving away from
 * it is upwards in each card's own rotated frame.
 */
const SPREAD_DEGREES = 7.5;
const LIFT_REM = -0.38;

export async function CardFan() {
  const hand = (await dealRound(ART_SEED, ART_ROUND, ART_SEATS, cardsInRound(ART_ROUND)))[0];
  const trump = trumpForRound(ART_ROUND);
  const middle = (hand.length - 1) / 2;

  return (
    <div className="fan">
      <div
        className="fan__cards"
        role="img"
        aria-label={`A hand of ${hand.length} cards: ${hand.map(cardName).join(", ")}. Trump is ${SUIT_LABEL[trump]}.`}
      >
        {hand.map((card, index) => {
          const offset = index - middle;
          return (
            <div
              key={`${card.rank}${card.suit}`}
              className={`fan__card${isRedSuit(card.suit) ? " fan__card--red" : ""}`}
              style={
                {
                  "--turn": `${(offset * SPREAD_DEGREES).toFixed(2)}deg`,
                  "--lift": `${(Math.abs(offset) * LIFT_REM).toFixed(3)}rem`,
                  // Later cards sit on top of earlier ones, the way a hand
                  // squared up in one direction actually looks.
                  zIndex: index,
                } as CSSProperties
              }
            >
              <span>{rankLabel(card)}</span>
              <span className="fan__pip">{suitGlyph(card.suit)}</span>
            </div>
          );
        })}
      </div>
      <p className="fan__caption">
        Round {ART_ROUND}, {cardsInRound(ART_ROUND)} cards each, trump is {SUIT_LABEL[trump]}{" "}
        <span className={isRedSuit(trump) ? "fan__trump fan__trump--red" : "fan__trump"} aria-hidden="true">
          {suitGlyph(trump)}
        </span>
      </p>
    </div>
  );
}
