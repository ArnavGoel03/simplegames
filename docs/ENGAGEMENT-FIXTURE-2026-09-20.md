# Engagement candidate verification

Verification-only branch `test/player-engagement-fixtures`. Both full browser
engines pass against games source `7c2f330`. Studio product code and deployment
remain unchanged.

## Final evidence

| Verification | Harness | Result |
| --- | --- | --- |
| [Full Chromium run 35514749358](https://github.com/ArnavGoel03/simplegames/actions/runs/35514749358) | `c4091c2` | Success: 14 checks, 7 scenarios, zero errors |
| [Full WebKit run 35516155968](https://github.com/ArnavGoel03/simplegames/actions/runs/35516155968) | `2b534e2` | Success: 14 checks, 7 scenarios, zero errors |
| [Strict Daily Chromium run 35515425064](https://github.com/ArnavGoel03/simplegames/actions/runs/35515425064) | `8569447` | Success: actual rendered board reviewed |

All five canonical games release certificates pass. Candidate preview pointers
were restored after verification. Neither the games candidate nor Studio was
promoted: Neon migration 0013 authentication and public-copy approval remain
held, and the real-room gate was skipped. Intercepted navigation is not evidence
that a real multiplayer room works.

Local verification includes the complete toolchain/typecheck/zero-warning lint
gate, 171 Vitest tests and 44 release tests. The final navigation adjustment also
passes 30 browser-evidence tests and 8 fixture/workflow/readiness tests, scoped
lint, syntax validation and diff checks.

## Maintained coverage

`tools/verify-engagement.mjs` follows the existing history fixture in the manual
candidate workflow. It opens the actual immutable account, Daily and three
Solitaire pages. All account APIs are intercepted with synthetic values. Room
handoffs stop at intercepted navigation before opening any socket, with no real
account, invitation, room or database mutation.

Account checks cover career milestones, cloud continuations, owner-scoped local
rooms, friendship actions, invitation refusal/decline/cancel/accept and account
switching. Solo checks cover engine-generated saves, Daily continuation, all
three Solitaire restores, FreeCell conflict choice with retained recovery,
background identity checks, account changes and exclusive tab ownership.

The recap fixture bundles the actual GameArchive, MatchRecap and AccountProvider
components from the same games source. It uses candidate CSS and a
source/fingerprint-bound SHA256. Cancelling the real Share button must not write
the clipboard; the native rematch dialog must expose rival actions and close.
No product route is added.

The offline scenario refuses only solo API transport while keeping identity,
documents and assets available. It verifies local-save recovery during a cloud
outage, not physical-device offline or service-worker behavior. The existing
exact-candidate offline checks remain separate.

## Source and rendering guards

The generator imports the real engines, save validators, storage keys and
labels, checks the workspace fingerprint before and after generation, and
requires canonical in-progress saves to roundtrip exactly. That positive control
caught the initial product defect that rejected Daily's intentional one-seat
Ludo board. Corrected source `7c2f330` preserves it. Achievement-fill checks
compare accessible progressbars with the canonical theme token and include a
wrong-color control.

Solitaire provenance comes from the build stamp on the same immutable candidate
homepage, plus exact game-path/origin and Next-script-origin checks. Autosave
validation permits elapsed-time banking but rejects changed attempts, deals or
restored move prefixes. Solo captures dismiss the actual onboarding guide.

Daily rendering requires visible SVG/canvas content with positive dimensions and
stable geometry across two subsequent animation frames. The waiter is synchronous
because the installed Playwright poller treats an async predicate's Promise as
truthy. Calibrated controls reject absent, empty, hidden, zero-sized and unstable
renderers. Strict Chromium evidence and image review confirm actual board pixels.

## WebKit navigation finding and correction

Diagnostic 35515722919 placed all 30 account page errors and its recap identity
error strictly between beforeunload and pagehide. Twenty-two failing prefetches
started during departure; eight began just before it. Earlier identical URLs
completed 200, but none supplied a response for the latest failing request.
The installed Next scheduler requeues work as connections close and has an
outstanding navigation guard TODO, matching the observed cascade.

Scripted goto/reload/room handoff now waits for native networkidle with a 15-second
cap. Reading pages require actual app readiness, and recap waits for verified
identity before leaving its account shell. Intentional focus/account-switch races
remain unchanged. This condition-based sequencing resolved the departing-document
errors in the passing full WebKit run without arbitrary sleeps or exemptions.
All errors and timeouts remain fatal. No response filtering, prefetch disabling
or product patch was added. This does not claim rapid-navigation framework errors
are impossible.

Reports retain labelled canonical network traces and markers around navigation,
reload, focus, room handoff and close. Request query values retain the existing
hash/path handling. Instrumentation observes original fetch promises and native
readers. Independent failures aggregate and still fail the final assertion.

## Generate and run

Run the games repository's existing fixture test with
`PLAYER_HISTORY_FIXTURE_DIR` pointing at this branch's
`tools/fixtures/player-history` directory. Then run:

```
node tools/capture-session-fixture.mjs /absolute/path/to/games
node tools/capture-engagement-fixture.mjs /absolute/path/to/games
```

Generation never reads user cookies, browser storage or credentials. `--check`
validates canonical saves and component bundling without changing bound artifacts.
With exact candidate receipts in `RELEASE_CANDIDATES_JSON`, run
`BROWSER_ENGINE=chromium node tools/verify-engagement.mjs` or select `webkit`.
The manual `visual.yml` workflow retains JSON reports and screenshots.

Optional `engagement_only=true` runs the gate and engagement checks while skipping
other browser/performance suites. Its separate concurrency group cannot cancel
full release runs. Diagnostic outputs are labelled and cannot emit release
certification artifacts. A calibrated publication-guard check enforces this
boundary; both engines must pass the full workflow to certify candidates.
