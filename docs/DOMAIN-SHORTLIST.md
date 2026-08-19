# Studio domain shortlist

Last updated 18 August 2026. Every `.com` below was checked against Verisign
RDAP on that date (404 = unregistered). Availability rots, so re-check before
you buy: `curl -o /dev/null -w '%{http_code}' https://rdap.verisign.com/com/v1/domain/NAME.com`

About 450 candidates were swept. Rules applied: proper English only, no Hindi,
nothing dice-specific (the studio has to sit above a card game too), no
hyphens, no numbers, no invented spellings.

## Why the obvious ones are gone

`simplegames.com` is held since 2001 at GoDaddy and serves nothing, so it is
aftermarket stock at a five-figure ask. Every one-word English `.com` in this
space is taken bare: aboveboard, houserules, parlourgames, faceup, openhand,
wellplayed, yourmove, meeple, cardroom, glasstable, plainsight. A two or three
word phrase is what a studio `.com` costs in 2026, not a compromise.

## Finalists

| Domain | Name | The read | Strike against |
|---|---|---|---|
| `glasstablegames.com` | Glass Table Games | The one table nobody can cheat under. Names a place the way studios do, and every game ever made gets played on a table. | "Glass table" alone is furniture SEO. |
| `evenhandgames.com` | Even Hand Games | Double meaning: even-handed means fair and impartial, and a hand is what you are dealt. Shortest of the three. | Slightly quiet, does not paint a picture. |
| `lighttablegames.com` | Light Table Games | A light table is lit from beneath so nothing can hide on it. Same idea as glass, more elegant. | Light Table was a well known code editor, now dead. |
| `plainsightgames.com` | Plain Sight Games | Punchy and easy to say. | Two real strikes, see below. |

**Plain Sight, the strikes.** Plainsight Technologies is a funded vision-AI
company (formerly Sixgill, $12M raised June 2024) holding `plainsight.ai` and
owning the search results for the word. And the idiom is famous in the form
"hidden in plain sight", which points at concealment. Wrong direction for a
studio whose whole argument is that nothing is concealed.

GitHub orgs `glasstablegames`, `evenhandgames`, `lighttablegames`,
`facevaluegames`, `cleanhandsgames` and `plainsightgames` were all free on the
same date. Bare `glasstable` and `evenhand` are taken.

## Everything else that survived, by theme

Transparency: `facevaluegames.com`, `cleanhandsgames.com`, `openpalmgames.com`,
`intheopengames.com`, `inthecleargames.com`, `allintheopen.com`,
`nosleevesgames.com`, `handsonthetable.com`, `nohiddenhands.com`,
`openbookgames.com`, `aboveboardstudio.com`, `openhandedgames.com`,
`evenhandedgames.com`, `fairhandgames.com`, `steadyhandgames.com`

The room the games get played in: `gamesroomstudio.com`, `gamesroomco.com`,
`theboxofgames.com`, `thesnuggames.com`, `mantelgames.com`,
`drawingroomgames.com`, `cardtablestudio.com`, `longeveninggames.com`,
`takeaseatgames.com`, `pullupachairgames.com`

Play universals: `turnorderstudio.com`, `bestoffivegames.com`,
`takeaturngames.com`, `homerulesgames.com`, `housestylegames.com`,
`cleanplaygames.com`, `straightplaygames.com`, `fairandsquaregames.com`

Proof and craft: `waxsealgames.com`, `sealandsignet.com`, `assaygames.com`,
`plumblinegames.com`, `notells.com`, `pipandtally.com`,
`counterandtoken.com`, `fairshakegames.com`

Rejected on purpose: anything built on dice (`sealedroll`, `unloadeddice`,
`blindshuffle`) reads as one game rather than a studio. Anything Hindi
(`chaupar`, `charpai`, `kanche`) was ruled out by the English-only constraint,
and `chaupal.com` is taken regardless.

## When one is picked

The rename is cheap and stays cheap only until a domain is live. Studio name
lives in `src/lib/brand.ts`, the legal surface derives from `src/lib/legal.ts`,
and the 7 docs prerender from `LEGAL_DOCS`. One pass changes all of it.
