# Measured browser release budgets

Original live baseline workflow source: `e035d1d`. Both manual browser runs succeeded.
The baseline is performance evidence, not a candidate release certificate.
Circuit provenance came from its existing `/fair-play` footer because its old
homepage omitted the stamp. The candidate homepage now uses the shared stamp.
The original Chromium Casino trace retained a failed network check; those
baseline records did not certify a candidate release.

| Site | Startup ms | Interaction ms | Initial decoded JS/CSS bytes |
| --- | ---: | ---: | ---: |
| studio | 750 | 400 | 655360 |
| board | 1250 | 200 | 983040 |
| cards | 2250 | 100 | 1179648 |
| draw | 1450 | 100 | 983040 |
| words | 1400 | 100 | 983040 |
| teenpatti | 2100 | 350 | 1048576 |

Timing limits are rounded 1.5x the larger of the two measured browser medians.
Asset limits are rounded 1.25x the measured decoded byte count. Three fresh
contexts per engine are required. The checked policy records the exact source,
run and artifact for each baseline; the release recorder verifies those values
against the GitHub artifacts, not this table. These are regression budgets,
not mobile-network performance guarantees or physical Safari certification.

- Chromium: run `34764063259`, artifact `10318919838`.
- WebKit: run `34764064297`, artifact `10319967902`.

## Studio completed Games navigation, 14 September 2026

Studio uses the `games-navigation` metric for the interaction column above.
The earlier two-frame click timer could finish before the live Next link
committed its fragment navigation. The replacement waits for the expected
fragment and aligned target scroll, then two further stable frames. Its new
metric ID prevents evidence from the old definition satisfying this policy.

Both corrected manual baseline runs succeeded at workflow source
`d407937aeec90e4ee82757b475b2fc713243f38c`. Each observed live studio source
`e3812bed22a15b57349bdb87df22f5db6e3a768f` at
`https://glasstablegames.com`. GitHub run and artifact metadata were retrieved
through the authenticated API; both downloaded artifact SHA-256 digests matched.

| Engine | Samples ms | Median ms | Run | Artifact |
| --- | --- | ---: | --- | --- |
| Chromium | 178, 245.89999999999418, 362.30000000001746 | 245.89999999999418 | 34776157501 | 10324295125 |
| WebKit | 190, 203, 152 | 190 | 34776158934 | 10324130766 |

The existing timing rule gives
`ceil(max(245.89999999999418, 190) * 1.5 / 50) * 50 = 400 ms`.
This calibrates the completed-navigation measurement; it does not claim an app
speed improvement. Startup and asset measurement definitions are unchanged,
so their original baselines and stricter existing limits remain. The corrected
runs measured startup medians of 325.8999999999942 ms and 586 ms, and 511522
decoded asset bytes in every sample.

- Chromium artifact SHA-256: `f0e1c9aa9e60d2e41a0232c792de7bf938fc9b941b19d2d8f131d93c121afc29`.
- WebKit artifact SHA-256: `91d3c82a4918922924d1e086c7fd9c6e3c688602d00f1899e028d2e07f0a0a74`.
