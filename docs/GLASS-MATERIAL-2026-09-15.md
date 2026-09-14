# Shared glass release, 15 September 2026

Studio 0.5.2 is live from `bdd9c1695de829c6c3f6942075628fde83475f35`,
Worker `dfa1b3d7-5f8d-4d08-9d72-2aeca9eed578`, provider-verified at 100%.
The approved light-blue palette remains. Reflection, rim, blur and depth use
canonical game material CSS, mirrored from live Circuit with exact byte checks.
Only navigation and the stage caption sample the backdrop; opaque accessibility
fallbacks remain. Game palettes are independent of the studio palette.

174 Vitest tests, 33 release tests, native typecheck, zero-warning lint and the
production build/upload pass. The first local gate timed out under resource
pressure; the unchanged source passed its bounded retry without relaxed limits.

Browser certificates: Chromium `34891948474:10367511490`, WebKit
`34892919659:10367279311`. Both verify this exact candidate, all required checks
and existing budgets. Startup medians are 361.3/485 ms, Games navigation medians
46.4/81 ms, and initial decoded assets 511633 bytes. Native-control calibration
verifies 16px -> 1px -> 16px blur and restoration. Opaque Circuit entry panels
are calibrated by depth, not by adding blur. Harness commits `8226549` and
`bc7c3d6` correct those probe assumptions; application source remains `bdd9c16`.

Full live verification passes 144 checks. All ten startup assets and the service
worker match certified bytes, with a same-size corruption control rejected.
Catalogue, runtime, PWA and glass source match live Circuit. Temporary preview
settings were restored to false/false with provider readback.

Evidence: `.audit/glass-material/live-studio/exact-content.json`,
`.audit/glass-studio-verify-live.log`, `.audit/glass-studio-deploy.log`, and
`.audit/quality/deployments/studio-1789418162233.json`. Chromium and WebKit
candidate-evidence archives were downloaded and SHA-256 checked. Complete
Chromium renders and an earlier WebKit image of the same immutable candidate
were visually reviewed. The final WebKit visual ZIP remains partial; its passing
candidate-evidence archive and calibration log are complete and verified.

All five games also ship this material from `2831dad`: Circuit/Charade/Lattice
1.2.5, Deal 1.2.6, Casino 1.3.2. Combined verification passes 193 live checks,
97 exact startup assets and six exact service workers. The game repository's
`docs/GLASS-MATERIAL-2026-09-15.md` contains its full release ledger.

Physical Safari/home-screen/foldable checks and existing owner policy/support
obligations remain open. CI WebKit fixtures do not certify physical hardware.
