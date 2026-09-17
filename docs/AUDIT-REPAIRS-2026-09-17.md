# Studio audit repair record, 17 September 2026

## Scope and acceptance

The initial live HTTP response identified source `bdd9c16` and contained the
automatic diagnostic collector and its POST endpoint. The approved studio
privacy text denied that behaviour. Restore no automatic studio reporting,
keep recovery and offline behaviour, and refuse older clients' delivery without
reading or forwarding their payloads. Game telemetry is outside this change.

## Finding dispositions

| Finding | Disposition |
| --- | --- |
| Automatic studio telemetry contradicts policy | Removed from document, worker and footer adapters. Shared recovery is unchanged. Delete only the legacy local queue; inaccessible storage does not break startup. Retire POST with 410 and no request inspection. Previously stored server reports are not erased by this change. |
| Live bdd9c16 absent from main | Merged existing reviewed PR16 as bef637a. The deployed source and subsequent QA corrections are preserved. |
| Prize Wheel workflow removed | Restored existing probe for full candidate runs. The probe skips when no Casino candidate is supplied; focused controls/network runs keep their existing scope. |
| Terms replaced no-currency clause | Old wording is false for current play money. Exact replacement remains in PROPOSED-COPY-2026-09-13.md for approval, not published. |
| Fair play public-source sentence replaced | Replacement reused the existing About wording. The old claim would misrepresent private game repositories. No rollback. |
| Hero, CTA and player counts | Existing text was repositioned; Games targets the actual gallery, and solo support requires one-player counts. Preserve functional navigation and accurate counts. No fresh visual-quality claim. |
| Artwork from fixtures | The design record identifies actual rendered UI with synthetic data and captures. Current comment discloses that origin. Do not restore a false all-live-capture assertion. No new capture certification in this source pass. |
| Additional policy contradictions | Hosting, accounts, game storage and recovery/session-storage distinctions have exact proposals. Public legal copy remains pending approval. |

## Verification

The new collector regression test executes the actual document adapter, fires
application/worker/reconnection events, and verifies no network reports with
available or denied storage. The prior collector is the positive control.
The endpoint test fails if its request is inspected or fetch is called. Worker
lifecycle/cache tests remain in place. Generated audit worktrees are excluded
from compiler, lint and test discovery after an old nested checkout was found
being executed as part of this release's tests.

Local toolchain/typecheck/lint and 33 release-engine tests passed. The 12
focused privacy and worker tests passed. Full gate, production build, candidate
browser evidence and live promotion are still pending in this checkpoint.
No local browser result is claimed. CI browser receipts remain a required
promotion gate.
