Generated browser fixtures for canonical game accessibility components.

From Studio, after the games candidate build and upload:

```
node tools/generate-accessibility-fixture.mjs /path/to/chaupal-cards /path/to/receipts.json /path/to/public-build-configs.json
```

Receipts are the exact release candidate array passed to the visual workflow.
The configuration map is keyed by `words`, `cards` and `draw`; each value is
exactly `{ "site": "cards", "head": "full source HEAD", "publicEnv": {} }`
with the sorted public NEXT_PUBLIC_* build environment used by games cf.
Use the real public values from that build. Never pass a secret environment.
The generator recomputes the canonical source fingerprint and verifies the
existing build stamp, generated output and upload receipt before issuing a
manifest. Include generated `bundle.js` and `manifest.json` in the workflow
checkout used for the candidate run; do not rebuild them from a different tree.

The fixture bundles canonical Modal, BlankPicker, RoundBreak, DealBreak,
DrawCanvas and ReadAloud source. The CardTable score modal's original JSX and
Pachisa showdown's original functions are extracted with checked unique
boundaries. The synthetic shell supplies only fixed state, callback collection
and a pathname adapter. It uses each immutable candidate's actual stylesheets.
Each imported game source is hashed in the manifest; the bundle is also hashed.

The hosted `Verify accessibility` workflow step runs Chromium or WebKit checks
and captures phone, landscape and desktop layouts in both colour schemes.
Assertions cover native modal focus containment, background inertness, Escape
and trigger restoration; letter selection; keyboard pen, shape and guesser
mark callbacks; synthetic speech passage order, word/sentence boundaries,
late-event cancellation and navigation/Escape/popstate cleanup.

Synthetic speech does not certify actual voice quality or device speech event
support. These fixtures do not certify whole-table integration, a nonvisual
description of a drawing, screen reader output or physical-device behavior.
Browser image review remains required after hosted execution.
