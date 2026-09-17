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

The complete certified gate at `63a9c5f` passed 167 application tests and 33
release-engine tests, plus toolchain/typecheck/lint. The 900 ms typecheck budget
was unchanged. The 12 focused privacy and worker tests are included. A prior
contended run exceeded the idle limit and was not certified. Verbose test
progress keeps the existing bounded integration fixtures observable. Production
build, candidate browser evidence and live promotion are pending.
No local browser result is claimed. CI browser receipts remain a required
promotion gate.

## Candidate browser checkpoint

Candidate `143a7877-805b-479b-a8e9-e39392e0f896` is built from `63a9c5f`.
The clean production build and all 144 preview HTTP checks passed. Ten startup
assets and the service worker matched the certified bytes, with same-length
mutation controls rejected. PR17 is merged as `091df71`.

Chromium run35252436359 and WebKit run35252439698 passed functional checks,
including responsive, startup recovery, network, offline and update checks.
The release validator nevertheless refused promotion: WebKit startup samples
1136/1001/964 ms exceeded the unchanged 750 ms median limit. A fresh unchanged
live baseline at `bdd9c16` (run35253516416, artifact10512361474) measured
1186/601/754 ms and also exceeded that limit. Chromium candidate median was
563 ms. This is not a no-regression claim; an additional bounded unchanged
WebKit candidate run is in progress, with failed measurements retained.

Preview access was initially disabled by the prior release. The first candidate
browser attempt therefore received Cloudflare1042/404 and was not usable
evidence. Access was temporarily enabled for the studio Worker, retaining the
disabled workers.dev base route. It must be restored after promotion or pause.

## Final bounded result

The further unchanged-candidate WebKit run passed functionally but measured
789/1049/840 ms, still above the 750 ms median limit. Artifact10512237368 from
run35252439698 is retained in local preview-check evidence. The release validator
rejected promotion again. No further blind reruns or budget changes were made.
Production remains0.5.2/bdd9c16. The privacy fix is merged, not live.

Provider readback confirms temporary studio preview access restored to
`enabled=false, previews_enabled=false`. Restoration receipt:
`.audit/quality/preview-settings/studio-143a7877-restored.json`. The candidate is
immutable and can be investigated after explicitly reopening its preview.

Chromium PR run35251838079 passed twelve responsive captures and three startup
controls; its 390px light and 1440px dark screenshots were directly inspected.
The exact candidate's two-engine functional checks passed separately. Candidate
screenshot archive downloads hit their bounded timeout, so no separate manual
inspection of those latest image files is claimed.

Remaining technical work: a controlled WebKit performance comparison and a
passing unchanged-policy release receipt, then promotion and fresh live checks.
The existing same-run `tools/probe-performance.mjs` needs its service-worker
capability isolation brought into line with the canonical release harness before
its old-live diagnostic-report side effect is used as a timing control. Remaining
owner work: approve `LEGAL-APPROVAL.diff`; mailbox ownership and jurisdiction
remain unverified, with no invented promises.
