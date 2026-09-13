# Studio design, 13 September 2026

## Active request queue

- In progress: replace Charade and Casino title-only cards with actual rendered
  game imagery, with reproducible source captures.
- In progress: redesign the studio homepage and navigation with clearer game
  hierarchy, responsive composition, readable typography and polished controls.
- In progress: replace the dice-like studio mark with a distinct geometric
  Glass Table monogram, derived into header, favicon and installed-app assets.
- In progress in the primary repository: give every game PWA its own recognizable
  icon silhouette within a consistent family. Deal and Charade must be distinct.
- In progress in parallel: Casino material design, shared launch recovery,
  precise automatic diagnostics and Charade viewport fitting.
- Verification pending: rendered desktop, phone, landscape and same-page resize,
  light/dark and reduced motion; machine gates, production build and live release.

The requested AAA quality bar is assessed through concrete rendered quality,
accessibility and tested behavior. No public superiority claim is being added.
Existing project wording is reused. This branch starts from the canonical PWA
integration candidate so visual work retains its recovery and diagnostic fixes.

## Release

Not deployed. The live studio remains 0.3.0 until the separate PWA release.

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
  from the 1680 by 780 capture to its left 900 by 780 region. The studio release
  must follow that Casino design release so the picture matches the game.
- Both image alternative labels reuse the game names. The former arbitrary
  20-character minimum was removed; the test still requires nonempty labels.
- 107 tests, typecheck and lint pass after generating the service worker through
  the normal pretest hook. Final production rendering/build remains pending.

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
