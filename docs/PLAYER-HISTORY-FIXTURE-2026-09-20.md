# Player-history rendering fixture

Maintained verification tools only. No Studio or game deployment, private accounts,
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
browser. Retain the regression tools and regenerate the fixtures before
verifying a later games candidate.

The 30 captures establish static rendered component layout only.
`verify-account-session.mjs` separately opens the actual hydrated candidate
account page in a fresh browser context. Identity reads, sign-out and friend
requests are intercepted. The only supplied cookie is a synthetic presence hint;
`capture-session-fixture.mjs <games-checkout>` imports its canonical name from
the same source commit into `session.json`, without reading any credentials.

The hydrated checks retain a known owner while pending and failed background
checks hide the record link, update the owner/link after a focus refresh, release
a delayed old response after sign-out, and confirm a retained hint cannot undo
local sign-out on later focus. Native fetch settlement is observed before the
stale-response assertion, with successful replacement serving as its positive
delivery control. Screenshots and `account-session-<engine>.json` join the same
artifact. Both browser engines passed final-source runs35506744810/35506746098.
This does not certify server authentication, database reads or live pagination
requests; those retain their independent games checks.

The first Chromium run35506162691 and WebKit run35506164460 passed, but image
review caught cramped phone archive titles in Chromium: fixed action/date
columns left roughly40px for names and stacked each result across several
lines. This was a real layout defect despite zero document overflow. The
games source now wraps mobile actions below the title. Stronger fixtures add
rated rows and replay links alongside verification. The browser checks each
`data-game-title` for clipping, a120px minimum width and a two-line maximum,
calibrated by temporarily constraining a real title to16px. Final games source
`1eaf6c07aca650fe2b019c78ea6e72f1a0bebdff` passed Chromium run35506744810
and WebKit run35506746098. Chromium captures were reviewed; WebKit image review
is recorded separately. The earlier green runs do not certify this source.

Local verification: toolchain, typecheck, zero-warning lint and33 release tests
passed. Negative controls prove stale HEAD and tree fingerprints are rejected
before any browser launch. Application tests passed167/171; four unchanged `tools/cf.test.mjs`
cases exceeded5000ms: successful build/upload, static cache/two uploads, and
the two output-change cases. Both final browser runs passed the full Linux
gate before remote rendering. This harness performs no Studio deployment. Dependency installation also reported existing
node-domexception/glob deprecations and npm install-script approval notices;
the lockfile was preserved.

## Integration with current main

The final harness was integrated with main's existing Next16.3.5, React19.3.0,
OpenNext1.20.6, Vitest5.0.1 and Wrangler4.134.0 dependency stack. The complete
local `npm run gate` passes: native compiler calibration, typecheck,
zero-warning lint,171 application tests and33 release-policy tests. The four
earlier local subprocess timeouts do not recur. Fixture bytes, source binding
and browser verification tools are unchanged from the two successful final
candidate runs. Studio remains the separately verified0.5.3 production release;
merging these maintained checks performs no deployment.
