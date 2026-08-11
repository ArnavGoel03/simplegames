# Derivation vectors

`derivation.json` is not written by hand and not written by this repository. It
is the answer the **real** implementation gives, recorded so that the hand
copies in `src/lib/fairness.ts` and `src/lib/cards.ts` can be held to it.

Generated from, in the Chaupal repository:

- `packages/fairness/src/rng.ts` (`rollDie`)
- `packages/fairness/src/shuffle.ts` (`shuffleIndices`)
- `packages/cards/src/deck.ts` (`DECK`)
- `packages/cards/src/deal.ts` (`dealRound`)

## Regenerating

Needed whenever the Chaupal side of any of those four files changes. Until the
two repositories share a package, that is a human noticing, which is the
weakness this file reduces rather than removes. Stale vectors pass.

Run from a checkout of Chaupal, with this repository beside it, a throwaway
test that imports the four modules above by path, replays the three seeds in
`cases`, and writes the same shape back over `derivation.json`. Then run
`npm test` here. A failure means the mirror has drifted and the home page is
about to claim something untrue: fix `src/lib/`, do not edit the vectors to
match it.

## Why three seeds

`00..1f`, all `ff`, and a stride, so a copy that quietly worked on one class of
input has to work on three. The rolls run 24 deep, the shuffles cover rounds 1,
5 and 13 (the first, the one the home page shows, and the one that deals the
whole deck), and the hands are a four seat round five deal, which is what
`Commitment.tsx` puts on screen.
