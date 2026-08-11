import type { Metadata } from "next";
import { DECK } from "@/lib/cards";
import { REJECTION_CEILING, SEED_BYTES } from "@/lib/fairness";

export const metadata: Metadata = {
  title: "Fair play",
  description:
    "How the dice and the deal are derived: a seed committed to before the game, revealed after it, and rolls and shuffles anyone can recompute.",
  alternates: { canonical: "/fair-play" },
};

export default function FairPlayPage() {
  return (
    <section className="shell shell--wide band band--flush">
      <div className="prose">
        <p className="eyebrow">Fair play</p>
        <h1>What the games prove, and what they do not.</h1>
        <p>
          Most online dice, and every online shuffle, are a call to a random number generator on a
          server you cannot see. That is almost always honest and it is never checkable, which are
          different things. These games are built so the second one is true as well.
        </p>
      </div>

      <ol className="ceremony">
        <li data-step="before">
          <div className="prose">
            <p>
              Before a game starts, the server picks a secret number of {SEED_BYTES} random bytes
              and publishes <strong>SHA-256 of it</strong>. Every player sees that fingerprint. The
              number itself stays hidden.
            </p>
          </div>
        </li>
        <li data-step="also before">
          <div className="prose">
            <p>
              Every player contributes their own random number, also as a fingerprint first. The
              seed the game actually rolls from is derived from the server&rsquo;s number and all
              of the players&rsquo; together, so <strong>no single participant chooses it</strong>,
              including us.
            </p>
          </div>
        </li>
        <li data-step="during">
          <div className="prose">
            <p>
              Each roll is <strong>HMAC-SHA256 of the seed and the roll&rsquo;s position</strong>.
              Bytes at or above {REJECTION_CEILING} are discarded, because 256 does not divide by
              six and keeping them would make the low faces come up slightly more often. Keying
              each roll by its position rather than reading off a stream means any single roll can
              be recomputed on its own.
            </p>
          </div>
        </li>
        <li data-step="also during">
          <div className="prose">
            <p>
              A deal comes off the same seed. All {DECK.length} cards are shuffled by walking the
              deck from the back and swapping each card with one chosen by the same HMAC, again
              discarding any byte that would favour a low position, so the order is{" "}
              <strong>uniform rather than merely scrambled</strong>. The round number goes into the
              shuffle, so each deal of a match is independent and all of them still check out
              against the one number revealed at the end.
            </p>
            <p>
              A card can never be read off a die. Every message signed for a deal carries a label
              that no message signed for a roll can carry, so the two derivations cannot collide
              even though they share a seed.
            </p>
          </div>
        </li>
        <li data-step="after">
          <div className="prose">
            <p>
              When the game ends, every secret number is published. Hash them and compare against
              the fingerprints from the start; recompute every roll and compare against the game
              you just played. If a number was swapped part way through, the hash will not match,
              and there is no way to find a different number that hashes the same.
            </p>
          </div>
        </li>
      </ol>

      <div className="prose prose--gap">
        <h2>What this does not cover</h2>
        <p>
          It proves the dice and the deal were not rigged. It does not prove the person on the
          other side of the table is not looking at your screen, and it does not by itself keep a
          hand of cards out of the other players&rsquo; browsers. That second one is an ordinary
          software problem, handled by sending each player only what they have earned the right to
          see, and you have to take our word for that part.
        </p>
        <p>
          The source is public, which is the only reason our word is worth anything on it.
        </p>
      </div>
    </section>
  );
}
