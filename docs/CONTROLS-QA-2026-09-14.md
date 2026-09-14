# Focused game controls verification

The live release is `d587cdd`; candidate application changes are owned by the
game repository. This browser-only follow-up adds no application changes.

- [x] Calibrate the reported typing-focus failure and Roulette/Keno target sizes
  against the live Casino in Chromium and WebKit.
- [ ] Verify the same checks against the exact updated candidate receipts.
- [ ] Inspect captured report sheets, boards and active-hand controls at
  320x720, 844x390 and 1440x1000, preserving the same page and draft/selection.

`Visual review` with `controls_only=true` runs `tools/verify-controls.mjs`.
`baseline=true` explicitly selects live calibration and requires at least one
known defect to reproduce, plus successful read-only/gameplay controls. Normal
candidate verification requires every recorded assertion to pass. The script
prevents all API writes; no reports or accounts are created. Results and actual
rendered source identities are saved in `controls-<engine>.json`, alongside
screenshots. These diagnostic artifacts are separate from release certificates.
Normal candidate workflows also run these checks when the receipts include
Casino, sharing their install/gate with the full release verification. A failed
controls check keeps that workflow unsuccessful; its diagnostic results do not
replace any mandatory release check.

Live calibration at exact `d587cddf7cfd8d602df209e2fc2f2805339085fa`:
Chromium run `34876420049`, artifact `10360899155`; WebKit run `34876424208`,
artifact `10360408303`. Both reproduce initial/typing/return-focus failures,
Tab escaping the report sheet, undersized number targets, and editable bet
controls during an active hand. Both retain the report and settled bet drafts;
no API writes or runtime errors occurred. The 320px Keno and report captures
were visually inspected.

Roulette target widths are 36px at 320, 27.3px at 844, and 34.5px at 1440.
Keno targets are 27.6x34px, 31x36px, and 40.4x44px respectively. The first
calibration's Keno selection assertion mistakenly toggled the already-selected
default 18; those three failures are fixture errors, not evidence of a game
defect. The verifier now derives an unselected number before toggling it.
Candidate checks also scroll to the final board number and hit-test the
primary action, and existing guide dismissal supports the native modal wrapper.

The native-dialog calibration distinguishes browser chrome from background page
controls: Chromium and WebKit both yield an unfocused BODY at the tab-order
boundary, then return inside on the next Tab. The actual report matches that
control; background focus remains inert. Candidate WebKit run `34877895055`
passes all 32 controls checks and the complete release checks. Four-game runs
`34877557250` and `34877560223` pass both engines and all recorded budgets.

Chromium's later network trace recorded completed disk-cache reads followed by
native Other background refreshes canceled before headers. The classifier
requires the complete cached predecessor, matching document/request identity,
SWR headers, native completion, reader completion and explicit native cancellation.
Negative tests remove each prerequisite and retain real response/transport errors.
The local delayed-background control confirms the cached read is independent of
the refresh; navigation does not deterministically cancel it and is not asserted
to do so. The cancellation case is evidenced by the recorded candidate trace.
Final Chromium workflow verification remains pending; no application bytes change.
