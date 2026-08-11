"use client";

import { useEffect, useState } from "react";
import {
  bytesToHex,
  commitSeed,
  generateSeed,
  rollSeries,
  verifyCommitment,
} from "@/lib/fairness";

const DICE = 5;

type Stage = "committed" | "rolled" | "revealed";

interface Ceremony {
  seed: Uint8Array;
  commitment: string;
  rolls: number[] | null;
  stage: Stage;
  verified: boolean | null;
}

async function begin(): Promise<Ceremony> {
  const seed = generateSeed();
  return { seed, commitment: await commitSeed(seed), rolls: null, stage: "committed", verified: null };
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
    setState({ ...state, rolls, stage: "rolled" });
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
          01 Before the roll
        </p>
        <p className={`hash${state ? "" : " hash--pending"}`}>
          {state ? state.commitment : "waiting for a seed"}
        </p>
        <p className="note">
          A secret number was chosen and this is its SHA-256 fingerprint. It is published now,
          while the dice have not been rolled, so the number behind it can no longer be changed.
        </p>
      </div>

      <div className="ledger__row">
        <p className={`step${stage === "rolled" || stage === "revealed" ? " step--done" : ""}`}>
          <span className="step__dot" aria-hidden="true" />
          02 The roll
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
        {stage === "committed" ? (
          <button type="button" className="button" onClick={roll} disabled={busy}>
            Roll {DICE} dice
          </button>
        ) : null}
      </div>

      <div className="ledger__row">
        <p className={`step${stage === "revealed" ? " step--done" : ""}`}>
          <span className="step__dot" aria-hidden="true" />
          03 After the roll
        </p>
        <p className={`hash${stage === "revealed" ? "" : " hash--pending"}`}>
          {stage === "revealed" && state ? bytesToHex(state.seed) : "the secret number, once it is safe to publish"}
        </p>
        <p className="note">
          The secret number is published last. Anyone can hash it, compare it to the fingerprint
          above, and recompute every face for themselves.
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
