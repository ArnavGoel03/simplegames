# Focused game controls verification

The live release is `d587cdd`; candidate application changes are owned by the
game repository. This browser-only follow-up adds no application changes.

- [ ] Calibrate the reported typing-focus failure and Roulette/Keno target sizes
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
