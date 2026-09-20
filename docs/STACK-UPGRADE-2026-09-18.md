# Stable stack source verification, 18 September 2026

This source-only receipt is superseded by the qualified, live Studio 0.5.3
release in [STUDIO-STACK-RELEASE-2026-09-18.md](STUDIO-STACK-RELEASE-2026-09-18.md).
Fresh provider/source/asset and authenticated CI artifact readback confirms that
release. See STATE.md and `evidence/stack-upgrade-2026-09-18/reconciliation.json`.
The proposed legal wording remains unapplied; it was not part of the release.

Verified source `c51dfd707cdbe72029c0fe4bf24b9e38a643aded`, merged in PR20
as `48ad444f5579d11d5dc205c513de002b6f934e27`.

- Native TS7 calibrated with positive/negative fixtures; typecheck and lint pass.
- 171 Vitest and33 release-policy tests pass; production and Cloudflare builds pass.
- npm audit: zero vulnerabilities.
- [Chromium run35270371530](https://github.com/ArnavGoel03/simplegames/actions/runs/35270371530) passes.
- [WebKit run35271556088](https://github.com/ArnavGoel03/simplegames/actions/runs/35271556088) passes.
- Twelve responsive captures plus two contrast captures per engine were inspected.
  Reports have no overflow, clipped footer stamps or runtime errors. Startup recovery
  controls and Games navigation pass. Full captures and machine reports are retained
  in [evidence/stack-upgrade-2026-09-18](evidence/stack-upgrade-2026-09-18/).

The hosted tests use runner-local production builds. WebKit startup median407ms
and navigation median189ms describe that local server, not Cloudflare delivery.
No exact candidate release receipt or production promotion was issued. Existing
edge startup750ms and legal holds remain; prior live deployment is unchanged.
