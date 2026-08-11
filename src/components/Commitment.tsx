"use client";

import { useEffect, useState } from "react";
import {
  bytesToHex,
  commitSeed,
  generateSeed,
  rollSeries,
  verifyCommitment,
} from "@/lib/fairness";
import {
  cardName,
  cardsInRound,
  dealRound,
  isRedSuit,
  rankLabel,
  suitGlyph,
  SUIT_LABEL,
  trumpForRound,
  type Card,
} from "@/lib/cards";

const DICE = 5;

// One seed serves both games, so the demonstration shows both coming out of
// it. The round and the table size are the smallest ones that make the point:
// round five of a four player match deals five cards each, which is a hand
// somebody can look at and recognise as a hand.
const ROUND = 5;
const SEATS = 4;
const HAND = cardsInRound(ROUND);

type Stage = "committed" | "rolled" | "revealed";

interface Ceremony {
  seed: Uint8Array;
  commitment: string;
  rolls: number[] | null;
  hand: Card[] | null;
  stage: Stage;
  verified: boolean | null;
}

async function begin(): Promise<Ceremony> {
  const seed = generateSeed();
  return {
    seed,
    commitment: await commitSeed(seed),
    rolls: null,
    hand: null,
    stage: "committed",
    verified: null,
  };
}

export function Commitment() {
  const [state, setState] = useState<Ceremony | null>(null);
  const [busy, setBusy] = useState(false);

  // The seed is random, so it cannot exist during the server render without
  // the two renders disagreeing. The pending markup below is what the page
  // ships with and what a reader without JavaScript keeps.
  useEffect(() => {
    let live = true;
    void begin().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  async function roll() {
    if (!state) return;
    setBusy(true);
    const rolls = await rollSeries(state.seed, DICE);
    const hands = await dealRound(state.seed, ROUND, SEATS, HAND);
    setState({ ...state, rolls, hand: hands[0], stage: "rolled" });
    setBusy(false);
  }

  async function reveal() {
    if (!state) return;
    setBusy(true);
    const verified = await verifyCommitment(state.seed, state.commitment);
    setState({ ...state, stage: "revealed", verified });
    setBusy(false);
  }

  async function again() {
    setBusy(true);
    setState(await begin());
    setBusy(false);
  }

  const stage = state?.stage;

  return (
    <div className="ledger">
      <div className="ledger__row">
        <p className={`step${state ? " step--done" : ""}`}>
          <span className="step__dot" aria-hidden="true" />
          01 Before the game
        </p>
        <p className={`hash${state ? "" : " hash--pending"}`}>
          {state ? state.commitment : "waiting for a seed"}
        </p>
        <p className="note">
          A secret number was chosen and this is its SHA-256 fingerprint. It is published now,
          while nothing has been rolled or dealt, so the number behind it can no longer be
          changed.
        </p>
      </div>

      <div className="ledger__row">
        <p className={`step${stage === "rolled" || stage === "revealed" ? " step--done" : ""}`}>
          <span className="step__dot" aria-hidden="true" />
          02 The roll and the deal
        </p>
        <div className="dice" aria-live="polite">
          {(state?.rolls ?? Array.from({ length: DICE }, () => null)).map((face, index) => (
            <span key={index} className={`die${face === null ? " die--empty" : ""}`}>
              {face ?? "?"}
            </span>
          ))}
        </div>
        <p className="note">
          Each face is HMAC-SHA256 of the secret number and the roll&rsquo;s position, taken one
          byte at a time and discarding anything that would favour a low face.
        </p>
        <div className="hand" aria-live="polite">
          {(state?.hand ?? Array.from({ length: HAND }, () => null)).map((card, index) =>
            card === null ? (
              <span key={index} className="card card--face-down" aria-hidden="true" />
            ) : (
              <span
                key={index}
                className={`card${isRedSuit(card.suit) ? " card--red" : ""}`}
                role="img"
                aria-label={cardName(card)}
              >
                <span className="card__rank">{rankLabel(card)}</span>
                <span className="card__suit">{suitGlyph(card.suit)}</span>
              </span>
            ),
          )}
        </div>
        <p className="note">
          The same number deals the cards, through a shuffle of all 52 keyed by the round rather
          than the roll. This is the hand the first seat is dealt in round {ROUND} of a{" "}
          {SEATS} player match, where trump is {SUIT_LABEL[trumpForRound(ROUND)]}. Dice and cards
          come off one seed and neither can be read from the other.
        </p>
        {stage === "committed" ? (
          <button type="button" className="button" onClick={roll} disabled={busy}>
            Roll and deal
          </button>
        ) : null}
      </div>

      <div className="ledger__row">
        <p className={`step${stage === "revealed" ? " step--done" : ""}`}>
          <span className="step__dot" aria-hidden="true" />
          03 After the game
        </p>
        <p className={`hash${stage === "revealed" ? "" : " hash--pending"}`}>
          {stage === "revealed" && state ? bytesToHex(state.seed) : "the secret number, once it is safe to publish"}
        </p>
        <p className="note">
          The secret number is published last. Anyone can hash it, compare it to the fingerprint
          above, and recompute every face and every card for themselves.
        </p>
        {stage === "rolled" ? (
          <button type="button" className="button" onClick={reveal} disabled={busy}>
            Reveal the number
          </button>
        ) : null}
        {stage === "revealed" ? (
          <>
            <p className="verdict" role="status">
              {state?.verified ? "Checked in your browser: it matches" : "It does not match"}
            </p>
            <button type="button" className="button button--quiet" onClick={again} disabled={busy}>
              Run it again
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
