# Glass Table experience work queue

## Requested direction

The studio should express its name through translucent material, a shared
table for social play, and the existing ability to verify game fairness.
Use forward pastel colour and glass surfaces. Preserve the checked background
the owner likes. Replace the dominant green studio cast. Carry studio identity
into the game saga without replacing each game's useful visual identity.

## Studio release, 14 September 2026

- [x] Studio 0.5.1 promoted and verified at source `007ca22d0e84afb119b3dcdf62cd2c356eac6764`,
  Worker `4f6f1da4-aebf-4817-b5a0-281bbd15eaf2`, with 100% provider traffic.
- [x] Studio gate: TypeScript 7, zero-warning lint, 154 Vitest tests and 33 Node
  release tests; warning-free build and 144 post-deploy live checks.
- [x] Live studio source, all ten startup CSS/JS assets and service worker match
  the certified output exactly, with same-size CSS mutation calibration.
  Temporary Worker preview access is disabled again; provider readback confirms
  `enabled=false` and `previews_enabled=false`. Receipt preview URLs are historical.
- [x] Both engines passed the exact studio candidate's responsive, entry,
  startup, network, failed-CSS, offline and update checks. WebKit offline uses
  the documented controlled worker fixture; physical-device behavior remains
  outside that evidence.
- [x] Studio performance policy now measures completed Games navigation.
  Corrected live baselines produce the 400 ms limit using the existing rule;
  startup and asset limits are unchanged. Final candidate measurements pass.
- [x] Studio release evidence and rollback identity recorded in
  `docs/RELEASE-2026-09-14.md` and `docs/STATE.md`.

The five game deployment receipts confirm 100% traffic at source
`d587cddf7cfd8d602df209e2fc2f2805339085fa`. Detailed game evidence remains in
the canonical game release records. Existing owner actions and physical-device
checks are unchanged.

## Game and owner follow-through

- [x] Investigate the owner's 18:00 Mac Casino unstyled launch. Reproduced
  stylesheet blocking and premature startup probes have shared repairs,
  calibrated browser checks and verified production releases. Physical Safari
  behavior remains subject to the explicit device-check limit below.
- [x] Simplify Circuit and Lattice's confusing start/mode screens on phone and
  desktop, preserving solo, friends, matchmaking, daily and ranked paths.

- [x] Studio: central pastel palette, glass layers, checked backdrop and clear
  reading surfaces in light and dark modes.
- [x] Studio: reduced transparency/motion, contrast and responsive review.
- [x] Casino: redesign the lobby, game discovery and presentation.
- [x] Casino: durable play progression and meaningful exploration, using the
  existing account and play-chip system with no real money.
- [x] Shared games: reuse studio material language in common chrome.
- [ ] Review new public wording separately under the owner's copy rule.
- [x] Build, test, visually inspect, ship and verify actual live revisions.
- [ ] Refresh project and Atlas release records.

## Verification constraints

Public PR browser runs passed twelve light/dark resize captures. Visual review
found a real clipped card-fan paint defect after resizing; isolating each fan's
indexed layers fixed it in the same capture sequence. Before/after artifacts
are retained locally in `.audit/`. Text contrast is at least 4.91:1 light and
6.10:1 dark across the sampled base, pastel and glass backgrounds.

The in-app browser had no available browser, the previous hosted allowance was
exhausted, and local Chromium was denied by the macOS sandbox. Manual public
GitHub CI now provides both-engine verification of the exact immutable releases;
earlier screenshots were not substituted for the final candidate evidence.
Physical iPhone/foldable checks and the earlier Draw/Lattice reruns remain open.
Existing public policy and support ownership decisions remain open.

### TypeScript 7 migration requested

- Studio migration complete: stable TypeScript 7, registry verification,
  old/new timing comparison, lint, typechecks and release build compatibility
  pass. Required compiler API consumers remain explicit. Game migration status
  is tracked in the canonical game release record.
- The released studio mirrors the shared startup repair and hydration-grace
  correction. Its full gate passed 154 Vitest tests, typecheck and lint.
- Browser fixtures calibrate the old classic inline mount under a stalled
  preceding stylesheet, then require the async module to recover a confirmed
  retired asset without reloading a healthy slow stylesheet. Both final studio
  browser runs passed that calibrated startup check.
- Earlier WebKit Casino captures exposed an immediate Chips assertion racing
  hydration. Final candidate verification and game production promotion have
  since completed; the canonical game release record holds that evidence.

### Owner-authorized quality enforcement

All seven proposed standards are now requested for implementation. The canonical
active checklist is in the game repository's
`docs/QUALITY-ENFORCEMENT-2026-09-13.md`: release evidence, browser checks, game
invariants, adverse network behavior, runtime boundaries, measured performance
budgets and exact-build diagnostics with rollback. Existing coverage is being
mapped before missing checks are added.

Studio TypeScript7.0.2 now passes actual compiler/API-resolution checks. ESLint's
required classic6.0.3 is isolated in a real package; a fresh lock resolution and
scoped override were necessary because npm's initial incremental solver kept
an invalid hoisted parser. npm ls now passes without invalid peers, and lint is
clean. Measured cold checks:1.629s->0.284s; warm:0.978s->0.199s. These are local
compiler measurements, not gameplay-performance claims.
