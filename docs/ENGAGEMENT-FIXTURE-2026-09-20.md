# Engagement candidate verification

Verification-only branch `test/player-engagement-fixtures`. Studio product code
and deployment remain unchanged.

`tools/verify-engagement.mjs` runs after the existing history fixture in the
manual candidate workflow. It opens the actual immutable account, Daily and
three Solitaire pages. All account APIs are intercepted with synthetic values.
The room handoff stops at intercepted navigation before opening any socket.
That check does not replace the games project's real-room gate.

The recap page uses a generated bundle of the actual GameArchive, MatchRecap
and AccountProvider components, compiled from the same games source. No product
route is added. Candidate CSS and a source/fingerprint-bound SHA256 constrain
that fixture. Cancelling its real Share button must not write the clipboard.
Its native dialog must expose the real rival actions and close correctly.

The account checks cover career and saved-game continuations, owner-scoped local
rooms, friendship actions, invitation refusal/decline/cancel/accept, and account
switching. Solo checks cover canonical engine-generated saves, Daily continuation,
all three Solitaire restores, FreeCell conflict choice and retained recovery,
account switching, background identity checks, and exclusive tab ownership.

The offline scenario refuses only solo API transport while keeping identity,
documents and assets available. It establishes local-save recovery during a
cloud outage, not physical-device offline certification or service-worker
transport behavior. The existing exact-candidate offline checks remain separate.

## Generate after the final games commit

Run the games repository's existing fixture test with
`PLAYER_HISTORY_FIXTURE_DIR` pointing at this branch's
`tools/fixtures/player-history` directory. Then, from this worktree:

```
node tools/capture-session-fixture.mjs /absolute/path/to/games
node tools/capture-engagement-fixture.mjs /absolute/path/to/games
```

The engagement generator imports the real engines, save validators, account
storage keys and labels. It recomputes the games workspace fingerprint before
and after generation and compares it with the static fixture manifest. It
never reads user cookies, browser storage or credentials. `--check` validates
canonical saves and component bundling without changing bound artifacts.

With the exact candidate receipt array in `RELEASE_CANDIDATES_JSON`, run
`BROWSER_ENGINE=chromium node tools/verify-engagement.mjs` or select `webkit`.
The manual `visual.yml` workflow does this automatically and retains
`.audit/visual/engagement-<engine>.json` plus screenshots. Reports include source
identity, intercepted request paths, synthetic writes, assertions and errors.

## Current verification

Canonical save generation and bundling pass locally. Four calibrated synthetic
transport tests pass, covering stale revisions, owner rejection, explicit branch
resolution and refusing unknown APIs. Focused script lint and syntax checks pass.
Final fixtures bind to games source `2e072b3` and its complete workspace
fingerprint. The local gate passes: toolchain, typecheck, zero-warning lint,
171 Vitest tests and 37 release tests. The first run hit an inherited
CF-wrapper timeout (5,370 ms against its unchanged 5,000 ms limit); after an
isolated dependency install, its focused regression passed in 1,074 ms and
the complete gate passed. Remote browser execution and rendered-image review
remain pending. No rendered success is claimed from these script checks.
