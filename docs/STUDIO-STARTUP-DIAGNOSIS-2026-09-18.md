# Studio startup: existing-capture diagnosis

Candidate source `a82c11f07c0f34d8fab29ad64b3e22429703c53f`, immutable Worker
`a444d357-3f5e-4b5d-bbf6-b09683bcd492`, remains held in draft PR19. No actionable
source defect or safe delivery fix was established. No timing retry followed
this investigation. The startup acceptance limit remains 750 ms.

## Evidence

Existing Chromium run `35265744862` and WebKit run `35265744554` supplied the
visual-review archives. Both archives passed ZIP CRC validation. The companion
`quality/studio-startup-diagnosis-2026-09-18.json` retains artifact IDs, archive
and extracted-file SHA-256 digests, all six browser samples, and their static
response headers and initial navigation intervals. No new browser was launched,
no preview access was enabled, and no CI run was dispatched.

| Engine/sample | Startup ms | DOM ready ms | App ready ms | DOM to app ms | App to startup ms | Request to first commit ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium 1 | 812.5 | 616.2 | 796.1 | 179.9 | 16.4 | 522 |
| Chromium 2 | 520.4 | 353.7 | 501.4 | 147.7 | 19.0 | 206 |
| Chromium 3 | 1370.1 | 1087.7 | 1339.4 | 251.7 | 30.7 | 811 |
| WebKit 1 | 683 | 209 | 501 | 292 | 182 | 111 |
| WebKit 2 | 934 | 476 | 793 | 317 | 141 | 368 |
| WebKit 3 | 1107 | 736 | 1010 | 274 | 97 | 573 |

The first six timing columns use the browser performance clock. The final
column is a separate harness wall-clock interval between navigation request
and the first frame commit, a coarse arrival observation, not browser TTFB.
Subtracting values across those clocks would not establish execution time.
Later same-document commits are deliberately excluded.

Chromium's initial commit interval varies by 605 ms and WebKit's by 462 ms.
Substantial variability therefore exists before startup JavaScript runs.
The samples also include app hydration and, particularly in WebKit, time after
app readiness. They do not support attributing every excess millisecond to
document delivery. All six samples have zero captured page errors and failed
requests, successful stylesheet checks, and the same 484,438 decoded JS bytes
plus 27,023 decoded CSS bytes. All twelve captured static responses per sample
(eight JS, one CSS, three fonts) returned 200.

## Source review and limits

- `tools/html-policy.mjs` pipes completed public cache-hit prerenders through
  `CompressionStream`. It does not await or buffer the complete body in its
  wrapper. Live shells and private responses remain outside compression.
- `src/components/ServiceWorker.tsx` announces app readiness from its hydration
  effect through `startWorkerClient`. That function dispatches readiness before
  any registration work and returns immediately when capability is absent, as
  in these cold samples. No registration or recovery timeout is on that path.
- `tools/browser-evidence.mjs` timestamps startup inside the page after DOM/app
  readiness, fonts and two frames. Driver-read delay is already excluded.
  Moving readiness earlier or omitting fonts/frames would change acceptance,
  rather than demonstrate faster startup.
- Fonts are already preloaded by the existing `next/font` layout. The captures
  have no font-ready timestamp or frame/CPU profile, so the WebKit post-ready
  interval does not prove a font or scheduling defect.

These captures do not contain document DNS/connect/TLS phases, provider
execution/cache timings, complete resource durations, or CPU/frame attribution.
Static-response header timestamps cannot locate transfer completion or script
execution. They cannot distinguish preview routing, connection setup, cache
delivery, host load or compression cost. The earlier comparison's document
TTFB finding remains supporting evidence, not a proved provider root cause.
No source edit is justified by the available attribution.

For a future authorized investigation, the missing diagnostic breakdown is:

- Browser navigation DNS, connect/TLS, request start, response start and response
  end, captured on the same clock as startup, with redirects identified.
- The corresponding document request ID/ray, provider request duration and CPU
  time, prerender/cache status, content encoding and cache-region information.
  Separate earlier HTTP compression receipts do not identify these six samples'
  document cache paths or execution durations.
- Resource start/end times and main-thread long tasks, together with DOM,
  hydration-effect entry, font-ready and each startup frame timestamp, to split
  download, execution, hydration, font and frame-scheduling costs.

This is a diagnostic prerequisite, not permission to dispatch another unchanged
timing run. Provider evidence from these requests would be preferable if it was
retained; the downloaded artifacts do not contain it.

## Queue

- Complete: inspect existing captures and startup/compression callers; preserve
  reproducible evidence and the unchanged release refusal.
- Held: identify a concrete source or delivery defect using attributable
  evidence, fix it, then verify that new candidate against the same acceptance
  checks before promotion. Do not repeat timing runs to obtain a passing sample.
- Held: legal wording approval, separately from this performance investigation.

Production remains 0.5.2/bdd9c16. Preview settings remain at their previously
verified restoration of false/false; this investigation made no provider writes.
