# Studio design, 13 September 2026

## Request status

- Live: Charade and Casino previews captured from actual rendered game UI.
- Live: responsive studio cover, game gallery and navigation.
- Live: custom Glass Table monogram, derived into header, share card, favicon,
  Apple and manifest assets from one drawing and palette.
- Live: distinct icons across every game PWA and the studio's game shortcuts.
- Live in the game release: Casino material design, shared launch recovery,
  precise automatic diagnostics and Charade viewport fitting.
- Verified: machine gates, builds, deployment, live metadata/assets/diagnostics,
  earlier browser layouts and final image/share/icon rendering.
- Outstanding: fresh final-page browser retake, physical Safari/foldable checks,
  and the separately documented Draw/Lattice room-suite reruns.

The requested AAA quality bar is assessed through concrete rendered quality,
accessibility and tested behavior. No public superiority claim is being added.
Existing project wording is reused. This branch starts from the canonical PWA
integration candidate so visual work retains its recovery and diagnostic fixes.

## Release

Studio 0.4.0, source `23ab6cefc865def6e483c6527638bebe47025b64`, is live as
Cloudflare Worker `4fdfe234-a7c0-47ee-96cd-3dcfebacc19b`. Normal non-force SSH
push updated main after GitHub's PR creation API repeatedly failed. The release
uses the certified build at that exact source; no local source-only state is
being called deployed.

110 tests, typecheck and lint pass. The production build has no warnings. The
upstream OpenNext deployment CLI emits Node 26 DEP0190; it was not suppressed.
Live verification passes 144 HTTP/metadata checks plus 63 focused design checks
(eight exact artwork/icon files, five distinct game shortcut PNGs, ten CSS/JS
startup resources and the actual 1200 by 630 share card). Catalogue, runtime
policy and all seven shared PWA sources match live Circuit.

Diagnostic receipt `2bf1311d-08b5-438d-8230-881d260a5c10` returned HTTP 204. One
filtered database row matched the exact 0.4.0/source/studio fields, then that row
was deleted and absence confirmed. Evidence is the original studio worktree's
`.audit/pwa/live-results-0.4.json`. No account or chip balance was changed.

## Implementation and verified evidence

- `studio-mark.json` holds the monogram geometry. Header, share card and all
  generated installed icons consume it. `palette.json` holds the colors;
  `npm run assets` derives CSS, SVG, PNG and ICO output from those sources.
  Revisioned icon metadata prevents new visits from requesting the old icon URL.
  Existing iOS home-screen icon replacement remains controlled by the OS.
- Seven same-page widths (320, 390, 844, 1024, 1440, 1976 and 2560) passed
  overflow/image checks in hosted Chromium. Light/dark hero and the Fair play
  page were inspected. Initial arrow glyphs were missing in the chosen font;
  replaced them with one shared SVG and moved the hero caption clear of the fan.
- Charade artwork is a real production canvas/tool-palette capture with a
  synthetic protocol fixture: normalized pen strokes draw a cat, with no live
  participant data or room write. Raw capture was 832 by 894, cropped to the
  832 by 734 canvas/palette region and resized to 1200 by 1059.
- Casino artwork crops the actual rendered material candidate's Roulette wheel,
  from the 1680 by 780 capture to its left 900 by 780 region. Casino 1.2.5
  was deployed before this studio release, so the image matches the game.
- Both image alternative labels reuse the game names. The former arbitrary
  20-character minimum was removed; the test still requires nonempty labels.
- 110 tests, typecheck and lint pass after generating the service worker through
  the normal pretest hook. The production build and live release checks pass.

Evidence: `.firecrawl/studio-design/report.json` and screenshots. Charade source
capture and fixture are in the primary worktree `.firecrawl/charade-art/` and
`.audit/charade-art.mts`; Casino source is `.firecrawl/casino-material-direction/`.
No physical Safari or foldable-hardware verification is implied by Chromium.

## Final verification limit

The production build passed without warnings. A fresh browser retake of the
last arrow/caption/crop refinements could not run: the hosted free allowance
was exhausted, the Browser connection list was empty, and local Chromium was
refused by the macOS sandbox at MachPort bootstrap. No paid upgrade or sandbox
bypass was attempted. The earlier seven-width layout matrix, independent source
review and final cropped-image inspection remain the visual evidence; they are
not represented as a fresh production browser pass.

The installed studio now also consumes each game's published icon metadata for
its shortcuts. Those five destinations are unique, and the catalogue importer
validates that icon URLs belong to their corresponding game origin.

Final live evidence: `.audit/live-design/report.json`, `icon-family.png` and
`share.png`; `.audit/live-verification.log`, `build-final.log` and `deploy.log`.
The live icon contact sheet and share image were inspected after deployment.
