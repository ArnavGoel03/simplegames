"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // Whether the ceremony is still running itself. It stops the moment a reader
  // takes a step by hand, so the two never race for the same transition.
  const auto = useRef(true);

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

  // Both steps take the ceremony they are acting on rather than reading it from
  // state, and write back only if it is still the current one. That is what
  // makes a timer and a button press safe to race: the loser's write is
  // discarded instead of resurrecting a ceremony the reader has already left.
  const roll = useCallback(async (current: Ceremony) => {
    if (current.stage !== "committed") return;
    setBusy(true);
    const rolls = await rollSeries(current.seed, DICE);
    const hands = await dealRound(current.seed, ROUND, SEATS, HAND);
    setState((live) =>
      live === current ? { ...current, rolls, hand: hands[0], stage: "rolled" } : live,
    );
    setBusy(false);
  }, []);

  const reveal = useCallback(async (current: Ceremony) => {
    if (current.stage !== "rolled") return;
    setBusy(true);
    const verified = await verifyCommitment(current.seed, current.commitment);
    setState((live) => (live === current ? { ...current, stage: "revealed", verified } : live));
    setBusy(false);
  }, []);

  const again = useCallback(async () => {
    auto.current = true;
    setBusy(true);
    setState(await begin());
    setBusy(false);
  }, []);

  /*
    The ceremony performs itself once, on arrival.

    It used to wait to be pressed, which meant the first thing a reader saw on
    the page arguing that nothing here needs to be taken on faith was a row of
    empty boxes and five question marks. A proof nobody ran is indistinguishable
    from a proof that does not work.

    The beats are deliberate rather than instant: the fingerprint has to be
    visibly published *before* the dice fill, because that ordering is the whole
    claim. Pressing anything hands control over and stops the timers.
  */
  useEffect(() => {
    if (!auto.current || !state) return;
    if (state.stage === "committed") {
      const timer = setTimeout(() => void roll(state), 1100);
      return () => clearTimeout(timer);
    }
    if (state.stage === "rolled") {
      const timer = setTimeout(() => void reveal(state), 1500);
      return () => clearTimeout(timer);
    }
    return;
  }, [state, roll, reveal]);

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
          <button type="button" className="button" onClick={() => {
              auto.current = false;
              void roll(state!);
            }} disabled={busy}>
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
          <button type="button" className="button" onClick={() => {
              auto.current = false;
              void reveal(state!);
            }} disabled={busy}>
            Reveal the number
          </button>
        ) : null}
        {stage === "revealed" ? (
          <>
            <p className="verdict" role="status">
              {state?.verified ? "Checked in your browser: it matches" : "It does not match"}
            </p>
            <button type="button" className="button button--quiet" onClick={() => void again()} disabled={busy}>
              Run it again
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
