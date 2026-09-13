# Glass Table Games

The studio site. Eleven content pages, no independent database and no analytics. Essential failure reports pass through a capped same-origin endpoint to the shared Circuit diagnostic store. Live at [glasstablegames.com](https://glasstablegames.com), and installable: it ships a manifest, the icons every platform asks for, and a service worker.

- `/` says what the studio does and demonstrates it: a real commit, roll and reveal ceremony run in the reader's own browser.
- `/fair-play` explains the derivation, and is honest about what it does not cover.
- `/about` names the person responsible.
- `/legal` lists seven legal documents.

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
npm run verify:live
```

The build stamps the generated service worker and records its input fingerprint. Deploy refuses a missing or stale build. Run `npm run lint`, `npm run typecheck`, and `npm test` before shipping.

## Visual assets

`src/lib/studio-mark.json` defines the monogram and `src/lib/palette.json` defines
the pastel, glass and checked-background colors. Run `npm run assets` to regenerate the shared CSS, SVG, PNG and ICO
outputs. `cf:build` does this before taking its source fingerprint. Header,
share-card and installed-app marks consume the same geometry. Icon metadata is
revisioned so a new icon does not reuse an old request URL; existing installed
Safari icon refresh remains OS-controlled.

The game catalogue publishes each game's icon URL. Studio shortcuts consume it
directly. `npm run sync:catalogue` updates the catalogue and checked PWA/runtime
mirrors from Circuit; `npm run verify:live` checks for drift after release.
Artwork provenance, screenshot evidence and remaining browser-validation limits
are recorded in `docs/STUDIO-DESIGN-2026-09-13.md`.

The public repository's Visual review workflow captures the production build
on pull requests, with a manual mode for the six public homepages. It uploads
light/dark screenshots at six viewport sizes and checks image loading, runtime
errors and resize overflow. Run `npm run build` then `npm run verify:visual`
locally when a supported Chromium environment is available. It has no schedule,
account credentials or game mutations. Screenshots still need human review.
Current glass-experience work is tracked in `docs/GLASS-EXPERIENCE-2026-09-13.md`.

## Where things live

| File | What it holds |
| --- | --- |
| `src/lib/brand.ts` | Every string that names the studio, the route list, the games. Nothing here is repeated anywhere else. |
| `src/lib/fairness.ts` | The roll derivation, mirrored from `packages/fairness/src/rng.ts` in the games monorepo so the home page demonstrates the real algorithm. |
| `src/lib/palette.json` | Canonical color tokens, including the light/dark glass and pastel surfaces. |
| `src/app/globals.css` | Sizes, material treatment and component classes using the generated palette. |

## Two things to keep true

**No wire identifier lives here.** The issuer and audience stamped into session tokens is `NAMESPACE` in the games monorepo's `packages/brand`. This site has no accounts and signs nothing, so a copy of it here could only ever be a copy that disagrees, and for a while it was.

**`src/lib/fairness.ts` is a mirror.** If `packages/fairness/src/rng.ts` in the monorepo changes, this file is wrong and the home page starts quietly lying. Check the two against each other at every release until they share a package.

## Current review

`docs/AUDIT-2026-09-13.md` records verified defects, regression calibration and release status. Public policy corrections remain proposed in `docs/PROPOSED-COPY-2026-09-13.md`; the older blanket claims about game accounts and storage are not accurate.

## Game catalogue

`src/lib/game-catalogue.json` is generated from the games' public release
catalogue. Run `npm run sync:catalogue` after a game release. The studio owns
presentation; the games own names, destinations and Deal's ordered game list.
`npm run verify:live` checks both live pages and catalogue drift. Teen Patti is
the fifth studio entry, while Rummy is the ninth game within Deal.

The sync command also mirrors Circuit's released `runtime-policy.mjs` byte for
byte into `tools/html-policy.mjs`. Both repositories build the same HTML wrapper;
live verification rejects a changed catalogue or helper. The wrapper preserves
cache policy while preventing Cloudflare from injecting analytics scripts.

Type checks and Next builds use the native TypeScript 7 compiler. ESLint's
JavaScript compiler API stays inside `tools/eslint-compat`; npm's linked-package
setting and the scoped compiler override keep that dependency separate. Run
`npm run gate` for the calibrated toolchain check, native typecheck, zero-warning
lint and tests. `verify:toolchain` checks the actual resolved parser, not only
the package lock, and rejects a deliberately invalid TypeScript fixture.
