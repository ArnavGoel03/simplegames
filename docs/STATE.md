# Simple Games: state of play

Last updated 11 August 2026. This is the pick-it-up-later document for the
whole studio effort: the studio site, Chaupal, and Judgement. Read this first
in any new session, then go to the file it points you at.

Written because three repos, two agents and one afternoon is more than any
session should have to re-derive.

---

## 1. The shape of the thing

**Simple Games** is a studio brand sitting above two game sites. It is the
developer-of-record for both, and it owns the legal surface for both.

| | What it is | Repo | Live |
|---|---|---|---|
| **Simple Games** | Studio site. The argument, the fairness explainer, all legal docs. | `ArnavGoel03/simplegames` (public) | https://simplegames-chi.vercel.app |
| **Chaupal** | Ludo and Snakes and Ladders. Dice you can verify afterwards. | `ArnavGoel03/chaupal` (**private**) | https://chaupal-games.vercel.app |
| **Judgement** | Trick-taking card game (Kachuful). Lives inside the Chaupal monorepo. | same monorepo | https://chaupal-games.vercel.app/judgement |

Three domains are planned, one per row. None are registered.

**Why the studio exists.** Two games needed one accountable name, one account
system, and one set of legal documents. Writing terms three times is how three
sets of terms drift apart.

**The thesis, in one line:** every roll and every shuffle is committed to
before anyone knows who it helps, and a player can check that afterwards
without trusting us. Everything else on the site serves that sentence.

---

## 2. Simple Games studio site: DONE and live

`~/dev/simplegames`. Next 16.3.0, React 19.2.8, TypeScript **pinned to 6.0.3**
exactly, eslint pinned `9.39.5`. 17 routes, every single one prerendered. No
middleware, no dynamic route, no database, no analytics, no cookies.

Push to `main` auto-deploys. The GitHub integration is connected and working.

### File map

```
src/lib/brand.ts        Single source: studio name, tagline, routes, nav,
                        the GAMES array, MAKER, resolveUrl().
src/lib/legal.ts        Single source for the legal surface (see §3).
src/lib/fairness.ts     A byte-mirror of packages/fairness/src/rng.ts and
                        shuffle.ts in chaupal. See "the mirror" below.
src/lib/cards.ts        A byte-mirror of packages/cards/src/{deck,rounds,deal}
                        .ts in chaupal. The deck order is FROZEN.
src/lib/mirror.test.ts  Holds both mirrors to what the real code answered.
src/lib/__vectors__/    Those answers, plus a README on regenerating them.
src/app/page.tsx        Home. Runs the real ceremony live in the browser.
src/app/fair-play/      The long explanation of the ceremony.
src/app/about/          Who is accountable. No team, no office, no investor.
src/app/legal/          Index + [slug] route, 7 docs prerendered by
                        generateStaticParams from LEGAL_DOCS.
src/components/legal/   One component per document + index.ts (LEGAL_BODIES).
src/components/Commitment.tsx   The live commit-roll-reveal widget.
src/app/icon.svg        Favicon. A die face showing three, on the diagonal.
src/app/opengraph-image.tsx     Share card, typographic, no photo.
```

### Three things that will bite whoever picks this up

**The mirror.** `src/lib/fairness.ts` and `src/lib/cards.ts` here are
hand-copies of `packages/fairness/src/{rng,shuffle}.ts` and
`packages/cards/src/{deck,rounds,deal}.ts` in chaupal. The home page runs them
live and claims they are the code the games run. If the chaupal files change
and these do not, **the home page starts quietly lying.**

Half of that is now a machine's job rather than a promise to look carefully.
`npm test` replays vectors recorded from the real implementation, so a drift on
**this** side fails 19 tests. It was calibrated by breaking the deck order on
purpose: four tests failed, and passed again on the revert. What it cannot see
is chaupal moving underneath it, which leaves the vectors stale and passing.
Regenerate them when the chaupal derivation changes, per
`src/lib/__vectors__/README.md`. One shared package is still the correct fix
and nobody has done it.

**`STUDIO_ID` is frozen.** `STUDIO_ID = "simplegames"` in `brand.ts` is the
intended token issuer and audience for one account across all products.
Changing it signs every player out everywhere. Chaupal currently ships
product-scoped `TOKEN_ISSUER` / `TOKEN_AUDIENCE` / cookie names of `chaupal`;
those have to become studio-scoped before any cross-app login works. That
migration has not started.

**The canonical URL is a workaround.** `simplegames.vercel.app` was already
taken by somebody else, so Vercel assigned `simplegames-chi.vercel.app` and
`resolveUrl()` hardcodes it. A canonical tag pointing at a stranger's site is
worse than an ugly one pointing at ours. Set `NEXT_PUBLIC_SITE_URL` the moment
a real domain exists and the hardcode stops mattering.

### Deliberate constraints, do not "fix" these

- **No location anywhere.** Not on the site, not in the legal docs. `MAKER`
  has a name and nothing else. Arnav did not want one stated. An unstated
  location is honest; a stale one is a small lie on a site whose entire
  argument is that it should not be taken on faith. The site previously
  claimed Bengaluru and that was removed.
- **No team, no office, no investor, no client logos.** It is one person and
  says so.
- **The about page says the game repos are not open yet**, because chaupal is
  private. If chaupal is ever made public, change that paragraph in the same
  commit.
- **Static CSP with `'unsafe-inline'` on script-src**, with a written
  justification in `next.config.ts`. A nonce needs middleware, middleware makes
  every route dynamic, and that kills the static prerender. Acceptable only
  because the site renders no user input. Do not "upgrade" this to a nonce
  without re-reading that comment.

---

## 3. The legal surface: DONE and live

Commit `a80258c`. Seven documents at `/legal`, linked from the footer of every
page.

| Slug | Title |
|---|---|
| `terms` | Terms of use |
| `privacy` | Privacy |
| `cookies` | Cookies |
| `rules-of-play` | Rules of play |
| `content` | Content and age |
| `accessibility` | Accessibility |
| `intellectual-property` | Copyright and trademarks |

### How it is wired

`src/lib/legal.ts` is the single source: slugs, titles, summaries,
`LEGAL_EMAIL`, `JURISDICTION`, `EFFECTIVE`. The footer, the index page, the
sitemap and `generateStaticParams` all derive from it. Adding a document means
adding one entry there and one component.

`LEGAL_BODIES` in `src/components/legal/index.ts` is typed
`Record<LegalSlug, ComponentType>`. This is deliberate: listing a document
without writing its prose **fails the build**, rather than shipping a 404 that
the footer links to from all 17 pages.

### Four editorial decisions with teeth

**`JURISDICTION` is `null` on purpose.** Terms §8 renders an honest "no
governing law is stated yet" paragraph while it is null, and a real governing
law clause the moment it is set. Setting it is a one-line change. It is null
because Arnav did not want a location stated yet, and governing law implies
one.

**Terms §2 is load-bearing.** No money is involved: nothing to buy, no virtual
currency, nothing cashable, and the studio takes no cut of anything players
arrange privately. It also states what would legally have to change before
stakes could exist (age verification, territory exclusions, identity checks, a
licence). Arnav's answer on stakes was "not now, maybe later", so §2 is
written to need **no retraction** if that changes.

**Privacy and cookies make unusually strong claims, and they are true.** Zero
cookies, zero third-party requests, fonts self-hosted. I probed the live site
before writing them rather than after. This means: **adding analytics, a font
CDN, an embedded video, a map, or any third-party script makes those pages
false.** Rewrite them in the same commit as any such change. The pages
themselves tell readers to open their network panel and check, so a false
claim here is a caught claim.

**Nothing claims a rating.** Content and age explains why there is no ESRB or
PEGI badge (these are web pages, not submitted titles) rather than implying
one. The parent-facing point is the honest one: a room is shared by link.

### BLOCKER: the contact address does not exist

`LEGAL_EMAIL = "simplegames.studio@gmail.com"`. **This mailbox has not been
created.** There is a `PENDING` comment on it in `legal.ts`.

All seven documents point at it, including the accessibility complaints route
and the copyright infringement claim procedure. A legal page naming an
unreachable address is worse than one naming none. This is the single highest
priority item in this document and it is a five-minute task for Arnav, not a
code change.

---

## 4. Judgement: live, and linked from here

Shipped inside `~/dev/chaupal` and live at
`https://chaupal-games.vercel.app/judgement`: its own page, its own card table
(`components/cards/`), lobby seating for 3 or 4, bidding, score pad and a
finish screen. The studio site now lists it as live and links to it, and the
footer of every page offers both games.

It is a route on Chaupal's deployment rather than a site of its own, and the
studio site links the real URL rather than the one the plan wanted. When
Judgement gets a domain, `GAMES` in `brand.ts` is the single edit.

Earlier in the build, `main` was at `25a5551 feat: bid, play and a per-seat
state frame in the protocol`, and `feat/cards-engine` had been merged.

**The design and the plan are written and committed:**

- Spec: `~/dev/chaupal/docs/superpowers/specs/2026-08-11-judgement-design.md`
- Plan: `~/dev/chaupal/docs/superpowers/plans/2026-08-11-judgement-engine.md`

The rules engine lives in `packages/cards`. The protocol work is in
`packages/protocol`.

### The architectural decision behind it

Reuse the internals, replace the entire front. Judgement shares the fairness
ceremony, the identity layer, the rating system and the realtime room with
Chaupal, but gets its own route group and a UI built only for cards. The point
was never to bolt cards onto a board-game interface.

Everything is being written so most of it could migrate to a native app later
if Arnav wants. That is a "keep the door open" constraint, not a commitment.

### The hard problem, named

**Per-seat state redaction.** The room currently broadcasts one identical state
frame to every socket. That is fine for Ludo, where the board is public. It is
fatal for a card game, where your hand must not reach the other players'
clients. Commit `25a5551` says a per-seat state frame is in the protocol now,
so this is being addressed, but it is the thing most likely to ship a subtle
leak. Anyone touching the room layer should assume this is where the bug is.

### Do not touch, in chaupal

- `packages/fairness/src/v2/derive.ts` is a frozen preimage.
- Another agent may be live in that working tree. **Never `git add -A` there.**
  Stage explicitly by path, and do not switch branches, because a checkout
  mutates the other session's working tree.

---

## 5. Atlas

Both projects are indexed. `~/dev/atlas/src/data/projects.ts` gained a
`simplegames` entry and a `chaupal` entry (Chaupal was missing from Atlas
entirely before this). Committed as `ad13577` and pushed.

---

## 6. Open items, in priority order

1. **Create `simplegames.studio@gmail.com`.** Seven live legal documents point
   at an address nobody can receive at. Arnav's task. Blocks the legal surface
   being real.
2. **Register domains** for `simplegames` and `judgement`. Then set
   `NEXT_PUBLIC_SITE_URL` on the Vercel project and the canonical-URL hardcode
   in `resolveUrl()` stops mattering.
3. **Judgement is live.** Per-seat redaction was the risky part and is the
   thing to re-audit first if a leak is ever suspected.
4. **Studio-scoped auth.** Chaupal's `TOKEN_ISSUER` / `TOKEN_AUDIENCE` /
   cookie names are product-scoped and must become studio-scoped before one
   account works across apps. Open question: whether Clerk satellite domains
   are available on the current plan.
5. **Make `fairness.ts` and `cards.ts` a shared package** instead of
   hand-copies. `npm test` now catches a drift on this side; only a shared
   package catches a drift on chaupal's.
6. **Watch the Vercel deploy cap.** 100 deploys/day is account-wide and now has
   to cover three projects. Skipped monorepo builds still count. A refusal
   shows up as a 402, and after that a `git push` silently does nothing.

---

## 7. Session conventions that applied here

- Never em dashes or en dashes, anywhere, including this file.
- Single source of truth: `brand.ts` and `legal.ts` exist so that no string
  appears twice. A literal in two files is a bug.
- Push to deploy. A change is not done until it is live.
- Look at the rendered output before calling visual work done. A green build
  cannot see a bulleted list that should not have bullets, which is exactly
  the bug a screenshot caught here.
