# Glass Table Games: state of play

> **Picking this up cold?** `docs/HANDOVER-2026-08-22.md` is the cross-repo
> handover: what is live, what the traps are, and what is open in priority order.

Last updated 22 August 2026. This is the pick-it-up-later document for the
whole studio effort: the studio site and the four game sites. Read this first
in any new session, then go to the file it points you at.

Written because three repos, two agents and one afternoon is more than any
session should have to re-derive.

---

## 0. The name is settled, and every site carries it

Renamed from **Simple Games** to **Glass Table Games** on 19 August 2026, and
the trial it started as is over. `simplegames.com` is held since 2001 and
unbuyable; `glasstablegames.com` was unregistered, was picked out of a sweep of
about 1,200 candidates recorded in `docs/DOMAIN-SHORTLIST.md`, and is now the
studio's own domain with the games on subdomains of it.

What was deliberately skipped during the trial has since been done, in this
order, on 19 and 20 August:

- **The domain is registered.** The studio answers at `glasstablegames.com`,
  with `www` attached and permanently redirecting to the apex.
- **The games moved onto subdomains** and were renamed to say what each one is
  rather than what category it sits in: Chaupal became **Circuit**
  (`circuit.`), Taash became **Deal** (`deal.`), Draw became **Charade**
  (`charade.`), and Lattice kept its name (`lattice.`).
- **The monorepo carries the studio name.** `packages/brand` has
  `STUDIO_NAME = "Glass Table Games"`, a `RETIRED_NAMES` list, and a check that
  fails when an old name reappears.
- **The namespace rotated** to `NAMESPACE = "glasstable"`, which is the token
  issuer and the prefix on cookies and storage keys. It was done while the
  number of live accounts was zero, which was the only window in which it was
  free.
- **This site holds no wire identifier at all.** The `STUDIO_ID` that used to
  sit in `src/lib/brand.ts` claimed to be that token issuer, was never used by
  anything here, and after the rotation was simply a copy that disagreed. It is
  gone, and `packages/brand` is the one place that knows.

Both older addresses still answer: the Vercel one, and the workers.dev one that
replaced it when that Vercel account was blocked for bandwidth and every site
on it began returning `402`.

---

## 1. The shape of the thing

**Glass Table Games** is a studio brand sitting above the game sites. It is the
developer-of-record for all four, and it owns the legal surface for all four.

| | What it is | Repo | Live |
|---|---|---|---|
| **Glass Table Games** | Studio site. The argument, the fairness explainer, all legal docs. | `ArnavGoel03/simplegames` (public) | https://glasstablegames.com |
| **Circuit** | Ludo and Snakes and Ladders. Dice you can verify afterwards. | `ArnavGoel03/chaupal` (**private**), `apps/web` | https://circuit.glasstablegames.com |
| **Deal** | The card room: Judgement, 29, Call Break, Pachisa, 3-2-5, and three games of patience. | same monorepo, `apps/judgement` | https://deal.glasstablegames.com |
| **Charade** | Everybody draws, everybody else races to name it. | same monorepo, `apps/draw` | https://charade.glasstablegames.com |
| **Lattice** | Words that cross, on a board that says what counts. | same monorepo, `apps/lattice` | https://lattice.glasstablegames.com |

**One domain, five deploys.** Every site is a Cloudflare Worker built on a
laptop and uploaded, which costs nothing and spends no build minutes. Each is
its own Worker with its own `wrangler.jsonc`, and each attaches its hostname as
a `custom_domain` so Cloudflare issues the certificate and the route together.
The realtime Worker is separate again and **must never be renamed**: its epoch
key lives in Durable Object storage, which a rename orphans.

The addresses moved twice before landing here. Vercel soft blocked the account
for bandwidth on 17 August 2026 and every site on it began answering `402`, so
everything went to `*.goelhome.workers.dev` on 18 August, and onto this domain
on 20 August. Both older addresses still answer.

**Why the studio exists.** Two games needed one accountable name, one account
system, and one set of legal documents. Writing terms three times is how three
sets of terms drift apart.

**The thesis, in one line:** every roll and every shuffle is committed to
before anyone knows who it helps, and a player can check that afterwards
without trusting us. Everything else on the site serves that sentence.

---

## 2. Glass Table Games studio site: DONE and live

`~/dev/simplegames`. Next 16.3.0, React 19.2.8, TypeScript **pinned to 6.0.3**
exactly, eslint pinned `9.39.5`. 17 routes, every single one prerendered. No
middleware, no dynamic route, no database, no analytics, no cookies.

**A push deploys nothing.** There is no GitHub integration on this project and
no build hook: `git push` updates the repository and the live site keeps serving
whatever was uploaded last. Shipping is `npm run cf:build` followed by
`npm run cf:deploy`, in that order and both of them. `cf:deploy` on its own
re-uploads the stale `.open-next` bundle and reports success, which is exactly
how a deploy on 21 August went out green while changing nothing.

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
src/app/page.tsx        Home. Hero, facts strip, game tiles, the ceremony,
                        the closing band. Runs the real ceremony in-browser.
src/app/fair-play/      The long explanation of the ceremony.
src/app/about/          Who is accountable. No team, no office, no investor.
src/app/legal/          Index + [slug] route, 7 docs prerendered by
                        generateStaticParams from LEGAL_DOCS.
src/components/legal/   One component per document + index.ts (LEGAL_BODIES).
src/components/Commitment.tsx   The live commit-roll-reveal widget.
src/components/CardFan.tsx      Deal's key art, dealt not photographed.
public/art/             Screenshots of the real boards, webp.
public/icon.svg         Favicon. The mark: a glass pane with two pieces. In
                        public/ rather than app/, because Cloudflare serves an
                        asset ahead of the Worker and a copy in both places is
                        a copy that drifts.
public/favicon.ico      16, 32 and 48, for Windows and for crawlers.
public/apple-touch-icon.png     180. Without it Safari draws a grey "G".
public/icon-{192,512}.png       What a manifest needs.
public/icon-maskable-512.png    The same mark, full bleed, for Android's crop.
public/icon-maskable.svg        The source that PNG is rendered from.
public/sw.js            Service worker. Pages network first, hashed assets
                        cache first, and only a 200 is ever stored.
src/app/manifest.ts     The manifest, every string derived from brand.ts.
src/components/ServiceWorker.tsx  Registers it, after load, failing quietly.
src/components/StudioMark.tsx   The mark, animated. A frost that clears.
src/components/TitlePlate.tsx   Typographic fallback for a game with no art.
src/app/opengraph-image.tsx     Share card, typographic, no photo.
```

### The look: art-forward, and why each piece is allowed to be there

The first version of this site was a typographic essay capped at `--page:
64rem` with no imagery at all. It was accurate and it read as a manifesto, not
as a studio. The redesign widens the chrome and puts the games on the page.

- **Two container widths.** `--page-wide: 84rem` is what the masthead, the
  footer, and every section wrapper use, via `.shell--wide`. `--page: 64rem`
  now only caps the *reading* blocks: `.docs`, `.docnav`, `.ceremony`. That
  split is what lets a document page keep a comfortable measure while its
  wordmark, heading and footer still share one left edge with the home page.
  The four document pages carry `shell shell--wide` for exactly this reason;
  removing it puts the h1 to the right of the wordmark, which is how the
  regression looked when it happened.
- **The hero bleeds.** `.stage` aligns its copy to the shell with
  `padding-inline-start: max(var(--gutter), calc((100% - var(--page-wide)) / 2
  + var(--gutter)))`. That is `100%`, not `100vw`, on purpose: with `100vw` a
  scrollbar shifts the headline out of alignment with the wordmark above it.
  On mobile the art takes `order: -1` so it sits above the copy, while the
  `h1` stays first in the DOM for screen readers and crawlers.
- **The board art is real.** `public/art/chaupal-ludo.webp` and
  `chaupal-snakes-and-ladders.webp` are captures of the live Circuit
  deployment, not mockups. The filenames keep the old name; renaming a
  committed asset costs a cache-busting redeploy and buys nothing. `GameArt` in `brand.ts` documents that rule. If a
  board is redesigned these are stale and must be recaptured, because a studio
  site arguing for checkability cannot ship a picture of a game that does not
  exist.
- **Deal's art is dealt, not drawn.** A card game has no public object to
  photograph: the table is the hands, and the hands are private. So
  `CardFan.tsx` deals seat one's round-seven hand with the same `dealRound`
  the real table uses, from a seed written into the source. Publishing that
  seed is the point of the comment on it: it is exactly why that seed must
  never deal a real hand. Taash's `art` is `null` in `brand.ts` and its
  `fallback` is `"cards"`, which together select the fan. Draw and Lattice are
  also `art: null` but `fallback: "type"`: a dealt hand is a true picture of a
  card game and a false one of a drawing game, and for a while both of them
  were shown holding cards they do not have.
- **Per-card rotation uses inline `style`**, setting `--turn` and `--lift`
  custom properties. This is legal under the static CSP because `style-src`
  carries `'unsafe-inline'`, which covers style attributes. It is the reason
  the fan does not need a client component or a stylesheet per card.
- **`next/image` everywhere, never `<img>`.** `core-web-vitals` is on and
  would warn. Dimensions come from `brand.ts`, the hero carries `priority`,
  and both image rules set `display: block` to kill the 1px inline-layout
  baseline sliver under the picture.
- **Motion is opt-out.** The `arrive` entrance and every hover transform sit
  inside `@media (prefers-reduced-motion: no-preference)`.
- **`GAMES_LINK` replaced `GAMES_ANCHOR`.** It is an object (`{path, label}`)
  so the header can spread it alongside `NAV` and no nav label is spelled
  twice. It is deliberately **not** in `ROUTES`, because `sitemap.ts` maps
  over all of `ROUTES` and `/#games` is an anchor, not a page.

Verified by screenshot at desktop and mobile, in both colour schemes, plus
`/fair-play`, `/legal` and `/about`. One trap worth writing down: full-page
CDP captures of this site render a ghost of the footer over the masthead. It
is a `captureBeyondViewport` compositing artifact, not a layout bug.
`elementFromPoint` in that band returns the masthead, and a viewport-only
capture is clean.

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

**A retired name cannot come back, and the check is what says so.** As of
22 August, `src/lib/names.test.ts` fails the suite on two things: any of
`Simple Games`, `Chaupal` or `Taash` appearing anywhere a reader can see it,
and `Glass Table Games` spelled out anywhere except `brand.ts`. Comments are
exempt from both, JSX comments included, because the history of what a thing
used to be called is written in them deliberately.

It exists because the games monorepo proved the drift is real rather than
theoretical: the day the studio was renamed, fifteen strings across four apps
went on offering "Your Simple Games account" to players, and the board site
called itself Chaupal in its 404, its share line and three route descriptions,
every one of them because the name had been spelled out instead of read from
the registry. This site was clean that day, which is not the same as being
safe. `scripts/check-names.mjs` in the monorepo is the same two rules, so the
two halves of one studio cannot disagree about what counts.

It was seen to fail before it was believed: a probe file carrying both a
retired name and the studio name failed both rules and named the line, and the
tree went green again when it was deleted. If a rename ever happens again,
appending to `RETIRED` there is the last step of it.

**The wire identifier is not here** (§0). It used to be, as `STUDIO_ID =
"simplegames"`, described as the token issuer and audience for one account
across every product. This site has no accounts and issues nothing, so it was
never that; the monorepo's `NAMESPACE`, now `glasstable`, always was. The
rotation happened on 20 August while the number of live accounts was zero,
which was the only window in which signing everybody out cost nothing. Do not
reintroduce a copy of it here.

**The canonical URL is hardcoded, and that is fine now.** `resolveUrl()`
returns `https://glasstablegames.com` unless `NEXT_PUBLIC_SITE_URL` says
otherwise, and `tools/cf.mjs` sets that variable on every build because the
site is built on a laptop where none of Cloudflare's own build variables
exist. Every canonical tag, share card, sitemap entry and robots line is
inlined at build time from it, which is why the address cannot be read from
the request.

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

`LEGAL_EMAIL = "glasstablegames.studio@gmail.com"`. **This mailbox has not been
created.** There is a `PENDING` comment on it in `legal.ts`.

All seven documents point at it, including the accessibility complaints route
and the copyright infringement claim procedure. A legal page naming an
unreachable address is worse than one naming none. This is the single highest
priority item in this document and it is a five-minute task for Arnav, not a
code change.

---

## 4. Deal: live, on its own subdomain

Shipped inside `~/dev/chaupal` as `apps/judgement` and live at
`https://deal.glasstablegames.com`: its own card table (`components/cards/`),
lobby seating, bidding, score pad and a finish screen. It began as a route on
Circuit's deployment called Judgement, became its own site, and was renamed
Deal on 20 August when it stopped being one game: Judgement is now the first of
eight in it. The studio site lists it as live and links it, and the footer of
every page offers all four games.

Every one of those addresses lives in `GAMES` in `brand.ts`, which is the
single edit when one of them moves.

Earlier in the build, `main` was at `25a5551 feat: bid, play and a per-seat
state frame in the protocol`, and `feat/cards-engine` had been merged.

**The design and the plan are written and committed:**

- Spec: `~/dev/chaupal/docs/superpowers/specs/2026-08-11-judgement-design.md`
- Plan: `~/dev/chaupal/docs/superpowers/plans/2026-08-11-judgement-engine.md`

The rules engine lives in `packages/cards`. The protocol work is in
`packages/protocol`.

### The architectural decision behind it

Reuse the internals, replace the entire front. Deal shares the fairness
ceremony, the identity layer, the rating system and the realtime room with
Circuit, but gets its own front end built only for cards. The point
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
`simplegames` entry and a `chaupal` entry (the monorepo was missing from Atlas
entirely before this). Committed as `ad13577` and pushed. Neither entry has
been retitled for the rename, and the repository directories still carry the
old names too, which is deliberate: a repo rename breaks every clone, remote
and deploy hook pointing at it, and buys a tidier name.

---

## 6. Open items, in priority order

1. **Create `glasstablegames.studio@gmail.com`.** Seven live legal documents
   point at an address nobody can receive at. Arnav's task. Blocks the legal
   surface being real.
2. **One sign-in across the subdomains, now unblocked.** The reason it could
   not work is gone: the games used to sit on unrelated hosts with no common
   parent a cookie may name, and they now all sit under `glasstablegames.com`.
   `cookieDomain()` in `packages/identity/src/session.ts` reads
   `SESSION_COOKIE_DOMAIN` and defaults to undefined on purpose, so this is
   setting that variable to `.glasstablegames.com` on each game Worker and
   redeploying. It is deliberately not done yet, because it rescopes the
   session cookie on four live sites and wants signing in on one subdomain and
   loading another, by hand, in the same sitting.
3. **Per-seat redaction in Deal** was the risky part of that build and is the
   thing to re-audit first if a leak is ever suspected.
4. **Make `fairness.ts` and `cards.ts` a shared package** instead of
   hand-copies. `npm test` here catches a drift on this side; only a shared
   package catches a drift on the monorepo's.
5. **Charade has no key art.** Its tile falls back to a type plate while the
   other three carry a screenshot of the real thing. That is the honest
   fallback rather than a placeholder, and it is still the weakest tile on the
   page. Fixing it means a real drawing captured from the live game.
6. **Circuit's manifest name is the odd one out.** Deal, Charade and Lattice
   install as "Name: what it is"; Circuit installs as just "Circuit", because
   `apps/web/src/app/manifest.ts` passes `site.name` for both `name` and
   `short_name` while the other three build the long form. One line, and it
   wants the Circuit Worker redeployed from `main`, not from whatever feature
   branch the monorepo is sitting on.
7. **The sections after 0 of `docs/RENAME-PLAN.md` are history, not a plan.**
   Most of what they describe has happened, out of the order they propose.
   Sections 12 to 16 (a brand-free package scope, the checks that fail on
   leakage, the fairness roadmap) are the parts still worth reading forward.

---

## 7. Session conventions that applied here

- Never em dashes or en dashes, anywhere, including this file.
- Single source of truth: `brand.ts` and `legal.ts` exist so that no string
  appears twice. A literal in two files is a bug.
- Push to deploy. A change is not done until it is live.
- Look at the rendered output before calling visual work done. A green build
  cannot see a bulleted list that should not have bullets, which is exactly
  the bug a screenshot caught here.

## 8. What search sees, 26 August 2026

The studio was not findable by name, and the reason turned out to be two
separate things with two different answers.

**The name is a shopping query and will stay one.** Searching the three words
returns glass chess sets, a glass poker table and a drinking game before any
organic result: the whole first screen is a product carousel. Nothing on this
site changes that, because the words describe a category of object that people
buy. The token that can be owned is the domain spelled as one word, and the
demand that is worth ranking for is not the studio at all. It is the games:
Ludo with friends, Call Break, 29, a Scrabble-like, a drawing game. Those
queries belong to the four game sites, whose titles and descriptions already
aim at them.

**The domain is a week old with almost no links into it.** Search Console on
26 August: 4 pages indexed, 24 not, of which 19 are "Crawled, currently not
indexed", which is Google saying it has seen them and has not decided they are
worth keeping. That is the ordinary state of a new domain nobody links to, and
the only cure is links and time. Technically the site was already clean: every
host answers 200, carries a canonical, a description, JSON-LD and a sitemap,
allows crawling, and the apex holds the Search Console verification TXT, which
makes one Domain property that covers all five hosts.

### What shipped for it

- **IndexNow, on all five sites.** A push protocol: rather than wait to be
  crawled, a site posts the addresses it wants read. Bing, Yandex, Seznam and
  Naver share one endpoint. **Google does not take part**, so this is a Bing
  and Yandex measure and nothing more. Here it is `npm run indexnow`, which
  reads the key back out of `public/<key>.txt` and submits every address in the
  live sitemap. The monorepo has the same thing at `scripts/indexnow.mjs`,
  deriving its hosts from `packages/brand` and its pages from each sitemap.
  Run it after a deploy, never before: the key file has to be reachable at the
  address being claimed.
- **`tools/site-url.mjs`.** The canonical origin was written down twice, in
  `brand.ts` and again in `cf.mjs`. It is read out of `brand.ts` now, so the
  build wrapper and the submitter cannot target an address the site does not
  claim.
- **The rooms Worker answers `robots.txt`.** A crawler followed the socket
  address off a game page, got the 426 that is the correct answer to a request
  that is not an upgrade, and filed it as a broken page on the domain. That is
  the "Blocked due to other 4xx issue" row. The refusal was right and the
  report was right, so the fix is to stop crawlers asking.
- **The apex robots.txt offers every game's sitemap.** Shipped 2026-09-02,
  deployed and verified over the network the same day: `glasstablegames.com/robots.txt`
  names its own sitemap and the four game sitemaps, which answer 200 with 17,
  11, 2 and 4 URLs. A crawler reads the apex before it has any reason to guess
  at a subdomain, and robots.txt is the one file it is certain to ask for.
  Cross-host references are honoured because the verification TXT sits on the
  apex, making one Domain property over all five hosts, which is the same fact
  the paragraph above rests on. The list derives from `PLAYABLE`, so a game
  that moves or arrives stays one edit in `GAMES`.
- **The links index carries the studio.** `~/dev/links` had no entry for it at
  all, so the portfolio's listing was the only page anywhere pointing here.
  Every string on that entry is this site's own, taken from `brand.ts`.

### What is still open on it

1. **Bing Webmaster Tools does not exist yet**, which is the account the
   IndexNow work is really for. Importing from Search Console carries the
   verification and the sitemaps across in one step. Recorded below.
2. **Links are the whole game for Google.** Three to five from places that are
   not his own sites would do more than everything above put together.
3. **Two lines in `~/dev/links` now enumerate five subjects for six volumes**:
   the sentence under the name and the meta description. Both are the owner's
   words, so they were left alone rather than reworded.

## Blocked on me

Steps below need a human. They are read by `pnpm owner` in `~/dev/atlas`, which
collects them from every repo and puts them in the Atlas briefing, so a step
recorded here cannot quietly evaporate the way one relayed in chat does.

Format: one record per blank-line-separated group, `key: value` per line.
`what` is required. `command` is what to run, `cwd` is where it must run,
`why` is why it cannot be done by an agent, `raised` is when it was first
raised, and adding `done: YYYY-MM-DD` clears it. Silence is not a status: an
item with no `done` date is still owed.

```owner-actions
what: Create `glasstablegames.studio@gmail.com`. Seven live legal documents point at an address nobody can receive at.
why: account signup.
raised: 2026-08-22

what: Sign in to Bing Webmaster Tools and use "Import from Google Search Console", which carries the verification and every sitemap across in one step. The IndexNow submissions already going out land in that account, and Bing indexes a new domain far faster than Google does.
why: account signup plus a dashboard step.
raised: 2026-08-26
```
