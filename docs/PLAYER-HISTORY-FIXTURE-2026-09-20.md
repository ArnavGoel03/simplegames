# Player-history rendering fixture

Verification branch only. No Studio or game deployment, private accounts,
credentials, new dependencies or duplicated product components are included.

`tools/fixtures/player-history/` is generated from actual PlayerHistory and
AccountPanel components by the games repository's
`apps/web/tools/preview-player-history.test.tsx`. Its20 synthetic games cover
all-game history, a Rummy comparison, an empty archive, a signed-in account and
an account reconciling its session. Account context and hidden data controls are
mocked. The manifest binds source HEAD, workspace fingerprint and every markup
file's SHA256. Regenerate after any games source change.

`tools/verify-player-history.mjs` requires a matching immutable board candidate
receipt, verifies its account page's source stamp, and uses that candidate's
built CSS and font classes. A browser route fulfills only synthetic fixture
documents; no fixture route is deployed. It checks row counts, pagination and
comparison URLs, record visibility, and a positively calibrated overflow
detector. Captures cover390x844,844x390 and1440x900 in light/dark themes for each
of five states (30images per engine).

The optional step runs through existing `visual.yml` candidate verification.
Use the normal Chromium and WebKit candidate dispatch inputs. Images and
`player-history-<engine>.json` join the existing `visual-review` artifact.
Fixtures without the matching candidate source are refused before launching a
browser. Remove the fixture files when this branch is no longer needed.

This establishes static rendered component layout only. It does not exercise
React hydration, identity network races, server authentication, database reads,
or live pagination requests. Those require their independent games tests.

Local verification: toolchain, typecheck, zero-warning lint and33 release tests
passed. Negative controls prove stale HEAD and tree fingerprints are rejected
before any browser launch. Application tests passed167/171; four unchanged `tools/cf.test.mjs`
cases exceeded5000ms: successful build/upload, static cache/two uploads, and
the two output-change cases. Full Linux gate, remote rendering, image review
and any release remain pending. Dependency installation also reported existing
node-domexception/glob deprecations and npm install-script approval notices;
the lockfile was preserved.
