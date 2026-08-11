# Simple Games

The studio site. Three routes, no database, no analytics, no third-party request of any kind.

- `/` says what the studio does and demonstrates it: a real commit, roll and reveal ceremony run in the reader's own browser.
- `/fair-play` explains the derivation, and is honest about what it does not cover.
- `/about` names the person responsible.

## Running it

```bash
npm install
npm run dev
```

## Where things live

| File | What it holds |
| --- | --- |
| `src/lib/brand.ts` | Every string that names the studio, the route list, the games. Nothing here is repeated anywhere else. |
| `src/lib/fairness.ts` | The roll derivation, mirrored from `packages/fairness/src/rng.ts` in the Chaupal repository so the home page demonstrates the real algorithm. |
| `src/app/globals.css` | Every colour, size and component class, defined once as tokens. A hex value anywhere else is a bug. |

## Two things to keep true

**`STUDIO_ID` is frozen.** It is the issuer and audience stamped into session tokens across every product the studio ships. Changing it signs every player out everywhere.

**`src/lib/fairness.ts` is a mirror.** If `packages/fairness/src/rng.ts` in Chaupal changes, this file is wrong and the home page starts quietly lying. Check the two against each other at every release until they share a package.
