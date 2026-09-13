# Measured browser release budgets

Live baseline workflow source: `e035d1d`. Both manual browser runs succeeded.
The baseline is performance evidence, not a candidate release certificate.
Circuit provenance came from its existing `/fair-play` footer because its old
homepage omitted the stamp. The candidate homepage now uses the shared stamp.
The Chromium Casino trace retains a failed network check; it is under review,
and no failed check can certify a candidate release.

| Site | Startup ms | Interaction ms | Initial decoded JS/CSS bytes |
| --- | ---: | ---: | ---: |
| studio | 750 | 50 | 655360 |
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
