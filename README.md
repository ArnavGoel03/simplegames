# Glass Table Games

The studio site. Five routes, no database, no analytics, no third-party request of any kind. Live at [glasstablegames.com](https://glasstablegames.com), and installable: it ships a manifest, the icons every platform asks for, and a service worker.

- `/` says what the studio does and demonstrates it: a real commit, roll and reveal ceremony run in the reader's own browser.
- `/fair-play` explains the derivation, and is honest about what it does not cover.
- `/about` names the person responsible.

## Running it

```bash
npm install
npm run dev
```

## Shipping it

A push deploys nothing: there is no build hook on this project. Both commands, in this order.

```bash
npm run cf:build
npm run cf:deploy
```

## Where things live

| File | What it holds |
| --- | --- |
| `src/lib/brand.ts` | Every string that names the studio, the route list, the games. Nothing here is repeated anywhere else. |
| `src/lib/fairness.ts` | The roll derivation, mirrored from `packages/fairness/src/rng.ts` in the games monorepo so the home page demonstrates the real algorithm. |
| `src/app/globals.css` | Every colour, size and component class, defined once as tokens. A hex value anywhere else is a bug. |

## Two things to keep true

**No wire identifier lives here.** The issuer and audience stamped into session tokens is `NAMESPACE` in the games monorepo's `packages/brand`. This site has no accounts and signs nothing, so a copy of it here could only ever be a copy that disagrees, and for a while it was.

**`src/lib/fairness.ts` is a mirror.** If `packages/fairness/src/rng.ts` in the monorepo changes, this file is wrong and the home page starts quietly lying. Check the two against each other at every release until they share a package.
