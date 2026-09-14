# Focused game controls verification

The live release is `d587cdd`; candidate application changes are owned by the
game repository. This browser-only follow-up adds no application changes.

- [x] Calibrate the reported typing-focus failure and Roulette/Keno target sizes
  against the live Casino in Chromium and WebKit.
- [x] Verify the same checks against the exact updated candidate receipts.
- [x] Inspect captured report sheets, boards and active-hand controls at
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
Final Chromium run `34880071384` at harness source
`e6eac59004d8c70b9f26db73b30182b930ece8b2` passes the complete workflow,
including all 32 controls assertions and the background-read calibration.
It records no readiness failures, API writes or runtime errors. Candidate
application source is `7dac09d55c2e4369cc73a0ce9be55d4fb80f5271`, Casino
Worker `3e5ef598-8261-4efc-81cf-3ef7dfd232dd`. All eight mandatory release
checks pass on both engines. Chromium startup/interaction medians are
863.8/27.4 ms; WebKit medians are 1831/168 ms. Both decode 853309 initial
JS/CSS bytes, below the unchanged 2100 ms, 350 ms and 1048576-byte limits.

| Scope | Engine | Successful run | Candidate artifact | SHA256 |
| --- | --- | --- | --- | --- |
| Casino | Chromium | 34880071384 | 10362257498 | `8be38d1a56380ef0cbbcca6e6a48d2c02949ec1681f2ee1c7d0a850eeb2a106f` |
| Casino | WebKit | 34877895055 | 10361438729 | `8a089715f82d79e422cad2fcdad0efcd671df8836e27514bc3c4effccf20c385` |
| Circuit, Deal, Charade, Lattice | Chromium | 34877557250 | 10360619706 | `2c3500aff2dd33d4fd14d57283bc94957f6d2acb5620a0a5834995e2a3cb852a` |
| Circuit, Deal, Charade, Lattice | WebKit | 34877560223 | 10361592314 | `f2ce0d3199b2c83ab8cf48764b226165b2138546fb1176bc4b93cd8125631581` |

Candidate report, scrolled Keno/Roulette and active-hand captures were inspected
at the tested sizes. The parent release review also compared the 844px active
hand with the live calibration. Controls remain legible and reachable; the
native wrapper preserves the report sheet appearance. Final visual artifacts
are Chromium `10362172655` and WebKit `10361951774`.

The preceding Chromium run `34879124413` passed all application checks but
failed an added fixture assertion that navigation must cancel a delayed cache
refresh. Removing that unproved assertion leaves the actual cached-read and
background-request controls, recorded candidate cancellation evidence and all
negative classifier tests intact. No application bytes or budgets changed.
These are browser-engine candidate checks; physical-device verification and
production promotion remain separate release work.
