# Rename the studio and the shared layer to Glass Table Games

> **Status: NOT EXECUTED.** Written 18 August 2026. Nothing in either repo has
> been changed. This document is the full execution record; a future session
> should be able to run it cold without re-deriving anything.
>
> **Blocked on:** registering `glasstablegames.com` (your call: hold the push
> until the domain exists so the canonical URL is right in the first commit).
> Secondary block: the Vercel account-wide 402 means nothing deploys anyway.
>
> **Companion file already on disk:** `~/dev/simplegames/docs/DOMAIN-SHORTLIST.md`
> (uncommitted) holds the ~450-name sweep, the finalists and why each runner-up
> lost. Move it to `docs/` in the renamed repo when this runs.

---

## 0. TODAY: live with the name before committing to it

**This supersedes the phasing below.** Decided 19 Aug 2026: rename the studio
site only, give it a real logo and animation, put it live on Cloudflare, and
spend some days reading the name on a screen before anything expensive happens.

### Deliberately NOT doing today

Every one of these is a commitment, and the point of a trial is to make none of
them:

- **Not buying the domain.** Deploy to a free `*.pages.dev` URL. Zero spend.
- **Not renaming either GitHub repo**, and not moving either local directory.
- **Not touching the monorepo at all.** No `@chaupal/*` sweep, no `NAMESPACE`
  rotation, so nobody is signed out and no storage is orphaned.
- **Not touching the six frozen hash literals.** They can never be changed again
  after launch, so they are the last thing to touch on a name you are trialling.
- **Not updating `STUDIO.name` in `packages/brand`**, which means the games keep
  saying Simple Games while the studio site says Glass Table Games. Two names
  coexisting is the correct state for a trial and is fixed in one line later.

Everything today is one `git revert` away from undone.

### Doing today

1. **Rename the studio site.** `src/lib/brand.ts` (`STUDIO_NAME`, `STUDIO_ID`,
   `STUDIO_DESCRIPTION`, `github`, `resolveUrl()`), `src/lib/legal.ts`
   (`LEGAL_EMAIL`), `package.json`, `README.md`, `docs/STATE.md`, and the
   possessive comment at `src/app/legal/[slug]/page.tsx:65`.
2. **A logo and its animation.** Concept below.
3. **The games list.** The site shows two of eleven, and two of its URLs point
   at dead Vercel hosts. Fix the addresses and add Draw and Lattice, with real
   screenshots per the `GameArt` rule (see section 14).
4. **Deploy to Cloudflare.**

### The logo: a pane that clears

The mark is the brand argument, not a decoration: a table seen from above, drawn
as a thin outlined pane with two or three pieces on it. The pieces cast their
shadow *through* the surface rather than onto it, because the surface is glass.

The animation, on first paint only: the pane starts frosted, and clears. What
was hidden underneath becomes visible. That is the studio's whole claim in about
600ms, and it is the one animation that means something rather than moving for
its own sake.

Constraints: inline SVG plus CSS, no JavaScript, no dependency. Uses
`currentColor` so it inherits both themes. Honours `prefers-reduced-motion` by
rendering the cleared state immediately. Reuses the existing `src/app/icon.svg`
slot for the favicon and feeds `src/app/opengraph-image.tsx` for share cards.

### Three deploy gotchas, found by reading rather than guessing

1. **`headers()` is a no-op in a static export.** The careful CSP in
   `next.config.ts` is delivered by Next's `headers()`, which does nothing once
   the site is exported. It must be ported to a `public/_headers` file, which is
   how Cloudflare serves headers. Miss this and the site silently ships with no
   CSP at all.
2. **`next/image` needs `images: { unoptimized: true }`** under `output:
   "export"`. `src/app/page.tsx:1` imports it for the game art.
3. **`opengraph-image.tsx` must be verified under export.** It generates share
   cards at build time; confirm the PNG actually lands in `out/` rather than
   becoming a route that expects a server.

If any of the three misbehave, the fallback is `@opennextjs/cloudflare`, which
keeps `headers()` and image optimisation working. There is already an
`open-next.config.ts` in `apps/judgement`, so the pattern is familiar. Static
export is tried first because the site is 100 percent prerendered and has no
server needs at all.

### Verification

`npm run lint`, `npm run build` (must stay 17 prerendered routes), and the
mirror test, which must keep passing untouched since no derivation is being
changed. Then screenshot the deployed page at real mobile and desktop sizes and
look at it, because a green build cannot see a logo that fails to clear.

---

## 1. Context: why this is happening

Two names are wrong at once, in different ways.

**The studio is called Simple Games and `simplegames.com` is unbuyable.** Held
since 2001, parked at GoDaddy, serving nothing, five-figure aftermarket ask.
Every free variant (`simplegamesco`, `wearesimplegames`) reads as a workaround.
After sweeping ~450 candidates against Verisign RDAP, the pick is **Glass Table
Games** at `glasstablegames.com`: a glass table is the one table nobody can
cheat under, which states the studio's entire argument as an object rather than
a claim. It also hands you an identity for free (transparent surface, see
through motifs) and it is not dice-specific, so a card game sits under it
without strain.

**The shared layer is called `chaupal`, which is the name of one of the games.**
The monorepo already knows this is wrong. `packages/brand/src/index.ts` opens
with:

> It is written studio-first because the studio is what the shared layer is.
> Chaupal, Judgement and 29 are siblings: none of them is the parent of the
> others, and a shared module carrying one game's name is how the fourth game
> ends up shipping under the third game's brand.

The display layer honoured that. The identifiers never did: the npm scope is
`@chaupal/*` across 18 packages, `NAMESPACE = "chaupal"` prefixes every cookie,
JWT claim and storage key, the IndexedDB database is `chaupal`, the root package
is `chaupal`, and the repo is `chaupal`.

**Outcome wanted:** one studio name across both repos, a shared layer named
after the studio, game brands untouched.

## 2. Decisions locked (asked and answered 18 Aug 2026)

| Question | Answer |
|---|---|
| Rename depth | **Everything, including the wire format.** `NAMESPACE` rotates. |
| Chaupal the game | **Keeps its name and its id.** Its address moves to `chaupal.glasstablegames.com`. |
| Repos and dirs | **Both rename.** `simplegames` to `glass-table-games`, `chaupal` to `glass-table`. |
| Naming style | **Kebab-case** where a separator is legal. |
| npm scope | **`@glass-table/*`.** Brand-free alternatives were offered and declined. |
| Registrar | **Cloudflare**, at cost with no renewal markup, not Spaceship. Zero add-ons. |
| Studio mailbox | **`hello@glasstablegames.com`**, free via Cloudflare Email Routing to Gmail. |
| Topology | **Subdomains under one domain**, one deploy per app (see section 13). |
| Future separate domains | **Kept open.** Identity gets its own origin now; no SSO flow built yet. |
| Shipping | **Hold the push** until `glasstablegames.com` is registered. |
| Hyphens in the domain | **No.** No SEO penalty (Mueller, June 2026) but it costs verbal sharing, invites typos, and leaves the unhyphenated twin buyable by someone else. |
| Frozen hash tags | **STILL OPEN.** Brand-free versus studio-named, see section 10. |
| The name itself | **FINAL: Glass Table Games.** Re-opened and re-confirmed against a genre-free alternative (Cairn Games) on 19 Aug 2026. |

**On the genre question, recorded so it is not re-litigated.** "Table" is a
category word and it does bound the studio to board and card games. That was
weighed deliberately: all eleven games shipped today are table games, the
provable-fairness moat only means anything at a table, and a specific name helps
a studio with no audience more than a vague one does. If a non-table game ever
happens, it ships under its own label rather than forcing a second rename. The
umbrella pattern already exists at Goel Studio.

## 3. The identifier map

| Surface | Before | After |
|---|---|---|
| Domain | (none, `simplegames-chi.vercel.app`) | `glasstablegames.com` |
| Studio display name | `Simple Games` | `Glass Table Games` |
| `NAMESPACE` (monorepo) | `chaupal` | `glasstable` |
| `STUDIO_ID` (studio repo) | `simplegames` | `glasstable` |
| npm scope | `@chaupal/*` | `@glass-table/*` |
| Root package (monorepo) | `chaupal` | `glass-table` |
| Package (studio repo) | `simplegames` | `glass-table-games` |
| GitHub repos | `ArnavGoel03/{simplegames,chaupal}` | `ArnavGoel03/{glass-table-games,glass-table}` |
| Local dirs | `~/dev/{simplegames,chaupal}` | `~/dev/{glass-table-games,glass-table}` |
| Session cookie | `chaupal-session` | `glasstable-session` |
| Storage keys | `chaupal:game-state` etc | `glasstable:game-state` etc |
| JWT issuer / audience | `chaupal` / `chaupal:session` | `glasstable` / `glasstable:session` |
| IndexedDB | `chaupal` | `glasstable` |
| Google postMessage source | `simplegames-google` | `glasstable-google` |
| Legal mailbox | `simplegames.studio@gmail.com` | `glasstablegames.studio@gmail.com` |
| Worker (deferred) | `chaupal-realtime` | `glass-table-realtime` |
| Game brand | `Chaupal` / `chaupal-games.vercel.app` | **unchanged** |

`NAMESPACE` cannot take a separator: `packages/brand/src/index.test.ts:10` pins
it to `/^[a-z][a-z0-9]*$/`. Hence `glasstable`, not `glass-table`.

## 4. The one-way costs

Rotating `NAMESPACE` is a rotation, not a rename. On the deploy that carries it:

1. **Every live session is signed out.** New cookie name, old cookie never read.
2. **Guests lose their history permanently.** A guest's only claim to their
   rating is the token (`packages/identity/src/tokens.ts`: no password, no
   email to recover with). Registered accounts survive in Postgres and can sign
   in again.
3. **Saved prefs and solo progress are orphaned**, not deleted: ~20 keys in
   `packages/studio/src/storage/keys.ts` move prefix.
4. **In-progress room seats break**: `seat-secrets.ts` IndexedDB name changes.

Acceptable only because every site is 402 and pre-launch. This gets expensive
the day after launch, which is an argument for doing it now rather than later.
Optional mitigation in Phase 2f.

## 5. Inventory (measured 18 Aug 2026)

**Studio repo `~/dev/simplegames`:** 25 hits across 8 files. Clean tree except
the untracked `docs/DOMAIN-SHORTLIST.md`. Branch `main`.

```
README.md                        title
package.json                     "name": "simplegames"
package-lock.json                name field
docs/STATE.md                    lines 1, 14, 19, 35, 37, 141, 148-149, 230, 295, 302, 305
src/lib/brand.ts                 STUDIO_ID:17, STUDIO_NAME:19, STUDIO_DESCRIPTION:28,
                                 resolveUrl():31-39, github:52
src/lib/legal.ts                 LEGAL_EMAIL:18
src/app/legal/[slug]/page.tsx    comment:65
docs/DOMAIN-SHORTLIST.md         new, records the decision
```

**Monorepo `~/dev/chaupal`:** 4,467 `chaupal` hits across ~780 source and doc
files, the overwhelming majority being `@chaupal/*` import specifiers. 18
packages plus 5 apps. **25 uncommitted files** at time of writing (solitaire
pool work, new klondike and spider packages, `apps/judgement/wrangler.jsonc`,
and two rename targets: `packages/brand/src/index.ts` and
`scripts/{host-env,check-host-env}.mjs`). Last commit `0b186d3`.

Packages: ai, appearance, brand, cards, daily, db, diagnostics, engine,
fairness, identity, lattice, pachisa, protocol, rating, solitaire, studio,
threetwofive, twentynine. Apps: draw, judgement, lattice, realtime, web.
Only `apps/realtime` is scoped (`@chaupal/realtime`); the four web apps are
bare names (`web`, `draw`, `judgement`, `lattice`) and stay that way.

**Outside both repos:** `~/dev/atlas/src/data/{projects.ts,pulse.json,claude-costs.json}`,
`~/dev/portfolio/src/lib/projects.ts`, and four memory files.

## 6. Execution

### Phase 0: clear the decks

A ~4,000 line rename on top of 25 dirty files is unreviewable. The two rename
targets already in the dirty set must land first.

```bash
cd ~/dev/chaupal
git add -A && git commit -m "feat: klondike, spider, and a bigger freecell pool"
# no push, Phase 5 holds the push
```

### Phase 1: studio repo

Hand edits, all of them small:

- `src/lib/brand.ts`
  - `STUDIO_ID` to `"glasstable"`. Rewrite the FROZEN docblock: it was frozen
    when account count was zero, and it is being rotated deliberately for the
    same reason. Note that it mirrors the monorepo's `NAMESPACE`.
  - `STUDIO_NAME` to `"Glass Table Games"`.
  - `STUDIO_DESCRIPTION` first clause.
  - `resolveUrl()` fallback to `https://glasstablegames.com` and rewrite the
    comment (it currently explains the ugly `-chi` alias, which stops applying).
  - `github` to `https://github.com/ArnavGoel03/glass-table-games`.
- `src/lib/legal.ts`: `LEGAL_EMAIL` to `hello@glasstablegames.com`, routed free
  through Cloudflare Email Routing to the existing Gmail (see open item 2). Do
  not buy the registrar's mailbox product.
- `src/app/legal/[slug]/page.tsx:65`: the comment reasons about the possessive
  of a name ending in s. "Glass Table Games" also ends in s, so the rule holds
  and only the quoted example changes.
- `package.json` + `package-lock.json` name to `glass-table-games`.
- `README.md` title, `docs/STATE.md` throughout (repo path, repo name, the
  STUDIO_ID note, the canonical-URL workaround note, Atlas note, next steps).

The fairness and cards mirrors carry **no** `@chaupal` import (verified), so the
frozen vectors in `src/lib/__vectors__/` are untouched by any of this.

### Phase 2a: package scope

```bash
cd ~/dev/chaupal
grep -rIl --exclude-dir={.git,node_modules,.next,out,dist,.turbo} '@chaupal/' . \
  | xargs sed -i '' 's|@chaupal/|@glass-table/|g'
sed -i '' 's|"name": "chaupal"|"name": "glass-table"|' package.json
pnpm install          # regenerates pnpm-lock.yaml, never hand-edit it
```

That single sweep covers package names, every import specifier, dependency
entries, and the `pnpm --filter @chaupal/db ...` invocations in
`packages/db/tools/*`. Check afterwards for tsconfig path mappings.

### Phase 2b: the wire format

- `packages/brand/src/index.ts:37` `NAMESPACE = "glasstable"`, and rewrite the
  FROZEN docblock. It currently says it reads "chaupal" for the historical
  reason that the first game shipped alone; it now reads as the studio, which
  is the invariant the file always wanted. Record the rotation date and that it
  was done pre-launch on purpose.
- `packages/brand/src/index.test.ts:18` the pinned expectation.
- `namespaced()` and `cookieName()` need no change: every key derives.
- `packages/studio/src/realtime/seat-secrets.ts:22` `DB_NAME`.
- `packages/studio/src/server/routes/google.ts:77` and
  `packages/studio/src/account/GoogleButton.tsx:24,140` `MESSAGE_SOURCE` to
  `"glasstable-google"`. **Both sides in the same commit**: it is a
  `postMessage` handshake and a mismatch fails silently, not loudly.

### Phase 2c: studio strings inside the monorepo

- `packages/brand/src/index.ts:49-50` `STUDIO.name` and `STUDIO.url`. The URL
  change also fixes the three derived `STUDIO_LEGAL` links.
- `packages/studio/src/language/languages.ts:68` display string.
- `packages/studio/src/studio.css:2` header comment.
- Explanatory comments in `packages/studio/src/server/routes/sign-up.ts:3`,
  `packages/identity/src/credentials.ts:3`, `packages/db/src/accounts.ts:3`.
- `packages/identity/src/credential-rules.ts:99` weak-password blocklist: add
  `glasstable` and `glasstablegames`, keep `simplegames`. A blocklist only grows.

### Phase 2d: env vars and scripts

- `CHAUPAL_NO_GIT_HEAD` to `GLASS_TABLE_NO_GIT_HEAD` in `scripts/host-env.mjs:121`
  and `scripts/check-host-env.mjs:88,104,146,151`. Internal only; no dashboard
  sets it.
- `CHAUPAL_WORKER` to `GLASS_TABLE_WORKER` in `scripts/probe-tables.mjs:28`,
  plus its temp file name `chaupal-probe-guests.json:46`.
- **Leave alone**, these are the game's address and it is not moving:
  `scripts/redeploy-live.sh:16`, `scripts/probe-rooms.mjs:16`,
  `scripts/smoke-room.mjs:4`, `packages/studio/src/analytics/redact.test.ts:6`,
  `packages/identity/src/rooms.test.ts:35,36,54`, and the `chaupal.example`
  hostnames throughout `packages/studio/src/server/same-origin.test.ts` (a test
  fixture domain, and a good one).
- `SITE_ORIGINS` derives from `GAMES[*].url` and needs no edit, because no game
  URL changes.

### Phase 2e: the realtime Worker (deferred to cutover)

`apps/realtime/wrangler.jsonc` is named `chaupal-realtime`, serving
`wss://chaupal-realtime.goelhome.workers.dev` to every game. Renaming it creates
a **new** Worker at a new hostname; Cloudflare does not rename in place.
Clients find it via `NEXT_PUBLIC_REALTIME_URL`
(`packages/studio/src/realtime/RoomSocket.ts:100`).

Order at cutover: deploy `glass-table-realtime`, set `NEXT_PUBLIC_REALTIME_URL`
on every app, verify a real two-browser room, then delete the old Worker once
traffic drains. Doing it during the code rename points live clients at a host
no deployed build knows about.

### Phase 2f: optional storage migration

If losing local prefs and solo progress is unacceptable, add a ~20 line
`migrateLegacyKeys()` beside `packages/studio/src/storage/keys.ts` that copies
each `chaupal:*` key to its `glasstable:*` equivalent on first load and marks
itself done. It cannot rescue sessions or guest identities (server-verified),
only local state. **Default: skip it.** Pre-launch, it is code you would delete
in a month.

### Phase 2g: monorepo docs

`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DIRECTION.md`, `docs/PLAN-DRAW.md`,
`docs/GOOGLE-SIGN-IN.md`, `docs/superpowers/specs/2026-08-11-judgement-design.md`.

Editing rule: every surviving `chaupal` must mean the game, its URL, or the
etymology note in the `GAMES` registry (the open square at the centre of a
village, echoing chaupar). Anything meaning "the studio" or "the shared layer"
is a bug.

### Phase 3: outside the two repos

- `~/dev/atlas/src/data/projects.ts` (both entries: name, repo path, links) and
  `pulse.json`.
- `~/dev/atlas/src/data/claude-costs.json` is **keyed by project directory
  name**. Renaming the dirs splits `chaupal`'s $1,328 and `simplegames`' history
  from their successors. Decide before the next `pnpm costs` run, which
  regenerates the file: either alias the old keys or re-key deliberately.
- `~/dev/portfolio/src/lib/projects.ts`.
- Memory: `project_simple_games.md`, `project_fair_ludo.md`,
  `reference_fair_ludo_files.md`, and the `MEMORY.md` index lines. Absolute
  paths in those files change too.

### Phase 4: repo and directory renames (at cutover)

```bash
gh api -X PATCH repos/ArnavGoel03/simplegames -f name=glass-table-games
gh api -X PATCH repos/ArnavGoel03/chaupal     -f name=glass-table
cd ~/dev/simplegames && git remote set-url origin git@github.com:ArnavGoel03/glass-table-games.git
cd ~/dev/chaupal     && git remote set-url origin git@github.com:ArnavGoel03/glass-table.git
mv ~/dev/simplegames ~/dev/glass-table-games
mv ~/dev/chaupal     ~/dev/glass-table
```

GitHub redirects the old URLs, but a stale remote is a trap for the next
session, so set both. Vercel keeps its git link through a GitHub rename. The
`vercel.json` `ignoreCommand`s use `git rev-parse --show-toplevel`, so the
directory move does not break them. Game deployment URLs do not change by
design. Attaching `glasstablegames.com` to the studio project retires the
`simplegames-chi` alias.

### Phase 5: gates, then the checks a gate cannot make

```bash
cd ~/dev/glass-table && pnpm install && pnpm gate
# gate = typecheck + lint + test, and test chains:
#   parity --check, check:vercel, check:host, check:dashes, check:pool
cd ~/dev/glass-table-games && npm run lint && npm run build   # must stay 17 prerendered routes
```

Then, by hand:

1. **Residual sweep.** In both repos:
   `grep -rIn --exclude-dir={.git,node_modules,.next,out} -iE '\bchaupal\b' .`
   Read every survivor. Each must be the game, the game's URL, the
   `chaupal.example` test fixture, or the etymology note.
2. **Boot it.** `pnpm dev`, open a table, and confirm in devtools: cookie is
   `glasstable-session`, storage keys read `glasstable:*`, IndexedDB is
   `glasstable`, and a fresh guest session mints and survives a reload.
3. **Google sign-in end to end**, because `MESSAGE_SOURCE` changed on both sides
   of a `postMessage` and a mismatch fails silently.
4. **A real room, two browsers**, against the still-old Worker host, proving the
   deferred Worker rename did not leak into this phase.

## 7. Risk register

| Risk | Blast radius | Mitigation |
|---|---|---|
| `MESSAGE_SOURCE` changed on one side only | Google sign-in silently never completes | Both files in one commit; manual sign-in test is a release gate |
| `pnpm-lock.yaml` hand-edited instead of regenerated | Install resolves to nothing, CI red | Always `pnpm install` after the scope sweep |
| Worker renamed before clients know the new host | Every live room dies | Phase 2e defers it to cutover, with old Worker kept alive |
| `sed` sweep hits `node_modules` or lock files | Corrupt deps, enormous diff | `--exclude-dir` set is in the command above; check `git status` count before committing |
| Cost ledger re-keyed by accident | $1,328 of chaupal build history detached | Decide in Phase 3 before running `pnpm costs` |
| Rename lands while Vercel is 402 | Nothing deploys, state drifts from git | Expected. The hold is deliberate. |
| A survivor `chaupal` means the studio | The exact bug this rename exists to fix | Residual sweep in Phase 5 step 1, read every hit |

## 8. Rollback

Every phase is a git operation on a dirty-free tree, so rollback is
`git reset --hard` to the Phase 0 commit in each repo, plus `pnpm install`. The
only steps that are not plain git:

- GitHub repo renames: rename back through the same `gh api` call. Old URLs keep
  redirecting either way.
- Directory moves: `mv` back.
- Worker: not deployed during the rename, so nothing to roll back.
- Cookie and storage rotation: not reversible for anyone who loaded the new
  build in between, which is nobody while the sites are 402.

## 9. Open items, in order

1. **Register `glasstablegames.com`** (Cloudflare Registrar, at cost, no
   markup). Everything holds on this.
2. **Set up `hello@glasstablegames.com`, free.** Move the domain's nameservers
   to Cloudflare (free), enable Email Routing, forward to the existing Gmail.
   Seven live legal documents point at this address. Do not buy Spacemail or any
   registrar mailbox: the six upsells offered at checkout total ₹27,861/yr for
   capability you already have. The old `simplegames.studio@gmail.com` was never
   created, so nothing is lost by replacing it with a branded address.
3. **Decide the `claude-costs.json` key question** before the next `pnpm costs`.
4. **Vercel 402 soft block** gates every deploy. The rename waits in git.
5. When this executes, copy this file into both repos as
   `docs/RENAME-GLASS-TABLE.md` so it survives outside a session, and move
   `DOMAIN-SHORTLIST.md` alongside it.

## 10. The frozen literals: rotate them too (zero DAU, confirmed 18 Aug 2026)

Six constants carry `chaupal` inside a hash input, a signed digest, or a
versioned data prefix. Each is marked FROZEN in its own comment because changing
it changes what the code computes rather than what it is called.

| Literal | Where | What changing it does |
|---|---|---|
| `SERVER_SEED_DOMAIN = "chaupal/v2/server-seed"` | `packages/fairness/src/v2/derive.ts:31` | Every derived server seed changes (`derive.ts:57`) |
| `COMBINE_DOMAIN = "chaupal/v2/combine"` | `packages/fairness/src/v2/derive.ts:32` | Every combined seed changes (`derive.ts:113`) |
| `PARTICIPANTS_DOMAIN = "chaupal/v2/participants"` | `packages/fairness/src/v2/attest.ts:30` | Invalidates every existing attestation (it sits inside a signed digest) |
| `DAILY_PREFIX = "chaupal-daily-v1:"` | `packages/daily/src/day.ts:27` | Changes which daily deal everyone gets, and it is **printed on screen** at `apps/web/src/components/daily/DailyScreen.tsx:217` |
| `PATIENCE_DAILY_PREFIX = "chaupal-patience-daily-v1:"` | `packages/solitaire/src/daily.ts:35` | Same, for patience. Lives in the currently uncommitted work, so Phase 0 must land first |
| `TAG = "chaupal-turn"` | `packages/studio/src/table/useTurnAlert.ts:31` | Notification tag only, trivial |

**With no daily active users, every one of these costs nothing to rotate, and
this is the last moment that is true.** Nobody holds a commitment that would
stop verifying, nobody holds an attestation, and nobody has a daily streak that
changing the seed would disturb. `DAILY_PREFIX` in particular is rendered to the
player as `seed = SHA-256("chaupal-daily-v1:2026-08-18")`, so leaving it would
put a game's name inside the studio's own fairness proof, on screen, forever.

Rotate to `glasstable/v2/server-seed`, `glasstable/v2/combine`,
`glasstable/v2/participants`, `glasstable-daily-v1:`,
`glasstable-patience-daily-v1:`, `glasstable-turn`. Keep the version numbers
where they are: `v2` tracks the derivation scheme, which is not changing, and
the `src/v2/` directory it matches is not moving either.

Test assertions to update alongside: `derive.test.ts:23,24` and
`day.test.ts:54`.

**The studio site's frozen vectors are NOT affected.** I checked the coupling
rather than assuming it: `src/lib/__vectors__/derivation.json` is generated from
`packages/fairness/src/{rng,shuffle}.ts` and `packages/cards/src/{deck,deal}.ts`,
and none of those four consume any domain tag (`rng.ts` and `shuffle.ts` import
only from `./primitives`). So no vector regeneration, and the mirror test in the
studio repo keeps passing untouched.

Still genuinely do-not-touch, for a different reason: `chaupal.example` in
`packages/studio/src/server/same-origin.test.ts` is a test fixture domain, and
the `chaupal-games.vercel.app` URLs in `rooms.test.ts` and `redact.test.ts` are
the game's real address.

## 11. Time and cost

Measured inputs: 1,006 source files, 161 test files, 587 files carrying an
`@chaupal/` specifier, 17 literal-namespace assertions across 6 test files (of
which roughly half must stay), `node_modules` warm at 1.6 GB, `.next` and
tsbuildinfo caches present, and `CLAUDE.md:100` puts a full `pnpm gate` at
about four minutes.

| Phase | Work | Estimate |
|---|---|---|
| 0 | Gate, then commit the 25 dirty files | 10 min |
| 2a | `sed` over 587 files, `pnpm install`, lock regen | 5 to 8 min |
| 1 | Studio repo: 8 files, docblock rewrites, lint and build | 15 min |
| 2b to 2d | Wire format, display strings, env vars: ~15 files, triage 17 test assertions | 25 min |
| 2g | Six monorepo docs | 15 min |
| 3 | Atlas, portfolio, four memory files | 10 min |
| 10 | Six frozen literals plus three test assertions and the on-screen daily sample | 20 min |
| 5 | Two to three gate cycles at ~4 min plus fallout fixes | 20 to 30 min |
| 4 | `gh api` renames, remotes, `mv` | 5 min |

| 12 | Centralisation so the next rename is a one-liner | 30 min |
| 13 | Subdomain topology, cookie domain, identity origin, Worker custom domain | 65 min |
| 14 | Studio site: four site tiles, eleven games, real screenshots | 45 to 60 min |

**Working total: about 4 hours 30 minutes.** Realistic band 4 to 5.5 hours,
the variance being gate fallout from the scope sweep and how many game captures
need re-taking. It splits cleanly into two sittings: everything that does not
need the domain (phases 0, 1, 2, 3, 10, 12 and the studio site content), then
everything that does (phase 13's DNS, phase 4's renames, the push).

Add on top:

- Register the domain: 5 minutes, yours.
- Create the mailbox: 5 minutes, yours.
- Runtime verification (boot, cookie in devtools, Google sign-in, two-browser
  room, one daily deal): 20 to 30 minutes, and it cannot be skipped because a
  green gate cannot see a broken `postMessage` handshake.
- Vercel 402 unblock: external, unknown.

No vector regeneration is needed (section 10), so the crypto rotation is 20
minutes rather than the 45 I first estimated.

Cost: route 2a, 2g and 3 to Haiku or Sonnet (pure mechanical sweeps) and keep
the wire-format edits and docblock rewrites on the top model. Roughly $20 to $35
routed, against $60 to $80 done entirely on Opus. For reference, chaupal has
averaged about $88 per session across 15 sessions.

## 12. Make the next rename a one-liner

This rename costs two hours. Most of that is avoidable forever, and the fix is
free to apply **during** this rename rather than as separate work. Breaking the
cost down by category:

| Category | Files | Avoidable? |
|---|---|---|
| Import specifiers `@chaupal/*` | 587 | **Yes.** Use a brand-free scope. |
| Frozen hash inputs (6 literals) | 6 | **Yes.** Use brand-free domain tags. |
| Wire namespace `NAMESPACE` | 1 | Already centralized. Cost is runtime, not code. |
| Display strings | 1 source | Already centralized. Working as designed. |
| Repo, directory, URL | few | No, but rare and cheap. |
| Prose in docs and comments | long tail | Partly, with a lint. |

The lesson the current code half-learned: `packages/brand` centralized the
*display* name and nothing else, so the brand leaked into the two layers it
should never have touched, module paths and hash inputs. A name belongs in
exactly one runtime constant. Everything a machine consumes should be named for
its **role**, not its brand.

### 12a. Brand-free package scope

Rename to `@studio/*` rather than `@glass-table/*`. Same one-line `sed`, same
cost today, and the scope never needs renaming again because it names what the
packages are, not who ships them.

```
@chaupal/brand   ->  @studio/brand
@chaupal/engine  ->  @studio/engine
...18 packages plus @studio/realtime
```

This alone removes 587 files from every future rename.

### 12b. Brand-free crypto domain tags

The six frozen literals in section 10 become brand-free rather than
Glass-Table-branded, which makes them genuinely frozen forever:

```
fairness/v2/server-seed      (not glasstable/v2/server-seed)
fairness/v2/combine
fairness/v2/participants
daily-v1:
patience-daily-v1:
turn-alert
```

Zero extra cost now, and a future rename never has to weigh breaking hash
outputs against carrying a dead brand inside a signed digest. Keep the FROZEN
comments, and add one line to each explaining that the tag is deliberately not
the brand so that a rename can never be tempted to touch it.

The on-screen daily line at `DailyScreen.tsx:217` then reads
`seed = SHA-256("daily-v1:2026-08-19")`, which is cleaner than either brand.

### 12c. Make a namespace rotation non-destructive

`NAMESPACE` stays the one brand-bearing wire constant, since cookie and storage
prefixes genuinely should be recognisable. Add beside it:

```ts
export const LEGACY_NAMESPACES = ["chaupal"] as const;
```

and a `readWithLegacy(key)` in `packages/studio/src/storage/keys.ts` that falls
back to each legacy prefix on read and rewrites under the current one. The next
rotation then costs one array entry and loses nobody's preferences. It cannot
save sessions (cookies and JWTs are server-verified), which is the honest limit.

### 12d. A gate that fails when the brand leaks

The monorepo already runs `check:dashes`, `check:vercel`, `check:host` and
`check:pool` inside `pnpm test`. Add `check:brand` in the same shape (the
Kaagaz repo already has this pattern, `pnpm check:brand`):

Fail the gate if the literal studio name, `glasstable`, or `glasstablegames`
appears anywhere except:

- `packages/brand/src/index.ts` (the one source)
- `docs/**` and `README.md` (prose, where a real name is correct)
- the studio repo's `src/lib/brand.ts` and `src/lib/legal.ts`

Everything else must import it. The rule the check enforces, worth stating in
its own error message: **prose says the studio's name, code derives it.**

While editing comments in Phase 2, prefer "the studio" over the literal name
wherever the sentence still reads correctly. That is what makes the long tail
short next time.

### 12f. Fix the registry drift while you are in there

`GAMES.draw.url` and `GAMES.lattice.url` in `packages/brand/src/index.ts` still
say `draw-games.vercel.app` and `lattice-games.vercel.app`. Both games actually
live on Netlify (`draw-games.netlify.app` and `lattice-games.netlify.app`, both
verified 200, documented at `docs/DEPLOYS.md:9-10`). The registry that is meant
to be the single source of truth for game addresses is pointing two of them at a
dead host, and `SITE_ORIGINS` derives from those URLs, so this is not cosmetic.
Section 13 replaces all of them anyway, which closes it.

### 12e. What this buys, honestly costed

Adds about 30 minutes to this migration. A future rename then costs:

| Piece | Time |
|---|---|
| `STUDIO_NAME` in two `brand.ts` files | 5 min |
| `NAMESPACE` plus a `LEGACY_NAMESPACES` entry | 2 min |
| Game URLs (one line if they derive from `DOMAIN`, see 12g) | 5 min |
| Package scope sweep, because the scope is branded | 20 min |
| Repos, dirs, DNS, four custom domain attachments | 25 min |
| Docs prose, flagged by `check:brand` | 15 min |
| Share cards and OG images, if the name is rendered into art | 15 to 30 min |

**About 1 to 1.5 hours, not the 30 minutes quoted earlier in this document.**
That earlier figure was the code-side change under a brand-free scope, which was
offered and declined, so the 587-file sweep is back on the bill.

The real saving is not the clock, it is the kind of work. Today is archaeology:
the brand is hiding in hash inputs, an IndexedDB name, a `postMessage` source
and three registries that disagree with each other. After this section,
`check:brand` fails the build if one literal survives outside its home and
typecheck verifies the scope sweep. Nothing is hunted, so nothing is missed.

### 12g. Derive game URLs from one domain constant

While editing the registry, make the addresses derive rather than repeat:

```ts
export const DOMAIN = "glasstablegames.com";
const site = (sub: string) => `https://${sub}.${DOMAIN}`;
```

`GAMES[*].url`, `CARD_ROOM.url` and `STUDIO.url` all build from it, so moving
domains later is one line instead of twelve, and the three registries that
currently disagree cannot drift apart again.

## 13. One domain, subdomains, one deploy per app

A domain does not reduce deploy count. Four Next apps compile to four bundles
whether they answer on four hostnames or four paths. What the domain buys is the
thing currently broken: `packages/identity/src/credentials.ts:5` already notes
that a cookie belongs to one origin, so today's mix of `chaupal-games.vercel.app`
and `draw-games.netlify.app` means "one account plays everything" cannot work.
Subdomains of one registrable domain fix that.

### Topology

```
glasstablegames.com            studio site (glass-table-games repo)
accounts.glasstablegames.com   identity origin (see below)
chaupal.glasstablegames.com    apps/web
draw.glasstablegames.com       apps/draw          (stays hosted on Netlify)
lattice.glasstablegames.com    apps/lattice       (stays hosted on Netlify)
cards.glasstablegames.com      card room: /judgement, /twentynine, /callbreak
realtime.glasstablegames.com   the Worker, replacing goelhome.workers.dev
```

Hosting does not move. A subdomain is a DNS record pointing at whichever host
already serves that app, so the Vercel, Netlify and Cloudflare split survives
untouched and the Vercel 402 does not block the Netlify pair.

### Work

- `GAMES[*].url` and `CARD_ROOM.url` in `packages/brand/src/index.ts`. Everything
  else derives: `SITE_ORIGINS`, `STUDIO_LEGAL`, the Worker's `ALLOWED_ORIGINS`,
  and `parseRoomId`.
- Session cookie gains `Domain=.glasstablegames.com`
  (`packages/identity/src/session.ts:70`), which is what makes one sign-in cover
  every game. Put the value in **one constant** in `packages/brand` beside
  `NAMESPACE`, so a future move to separate domains is a strategy change in one
  file.
- Worker custom domain in Cloudflare, then `NEXT_PUBLIC_REALTIME_URL` on every
  app. This is where the deferred Worker rename from section 2e lands, so do
  both at once and delete the old Worker after a verified two-browser room.
- Attach four custom domains: two in Vercel, two in Netlify. DNS records in
  Cloudflare, free and unlimited.
- Update `docs/DEPLOYS.md`, which is the file that records this topology.

**No security check needs loosening.** `packages/studio/src/server/same-origin.ts:44-47`
already accepts `sec-fetch-site: same-site`, with a comment saying a sibling
subdomain of our own is not a stranger. Verified before assuming it.

### Identity gets its own origin now

`accounts.glasstablegames.com`, rather than identity living inside `apps/web`.
It costs about 20 minutes today. The reason is the decision recorded in section
2: separate per-game domains stay open. Two different registrable domains can
never share a cookie, and third-party cookie blocking killed every silent
workaround, so a game that leaves the family needs a redirect handshake against
a central identity origin. Building that flow now would be paying for a feature
nothing uses; having the origin exist now means the flow can be added later
without extracting identity out of a game app under pressure.

The token layer is already the right shape for it: Ed25519 JWTs with issuer,
audience and public-key verification (`packages/identity/src/tokens.ts`). A
shared-secret session table would have forced a rewrite.

### The one thing to know before agreeing

`Domain=.glasstablegames.com` means **every** subdomain you ever create can read
the session cookie. Correct for four apps you own. Worth remembering the day
something untrusted needs a subdomain.

## 14. The studio site shows two games. There are eleven.

Verified live on 19 Aug 2026, every one returning 200:

```
chaupal-games.goelhome.workers.dev                    Chaupal
judgement-cards.goelhome.workers.dev                  Taash, the card room
  /judgement  /twentynine  /callbreak  /pachisa  /threetwofive
  /solitaire/freecell  /solitaire/klondike  /solitaire/spider
draw-games.netlify.app                                Draw
lattice-games.netlify.app                             Lattice
```

**Three registries disagree about all of this**, which is the same class of bug
as the studio name:

| Source | Says |
|---|---|
| studio site `src/lib/brand.ts` | `*.goelhome.workers.dev` (correct today) |
| monorepo `packages/brand/src/index.ts` | `*.vercel.app` (dead) |
| `docs/DEPLOYS.md` | Netlify for Draw and Lattice (correct today) |

Section 13 replaces every one of them with a subdomain, which collapses the
three into one answer.

### Structure

Four site tiles, not eleven, because four sites is what exists: Chaupal, Taash,
Draw, Lattice. The eight card and patience games are listed inside the Taash
tile rather than competing with it, which matches how `CARD_ROOM` already models
them. Note the card room is called **Taash** now, and the studio site's second
tile already says so while `GAMES.judgement` in the monorepo does not.

### The hard part: art

`GameArt` in the studio repo carries a rule with teeth: every image is a
screenshot of the real thing, taken from the live deployment and cropped, never
an illustration. A studio page that shows art the game does not match makes a
claim it cannot keep, on the one site whose argument is that it never asks to be
taken on faith.

So two new tiles need real captures at fixed dimensions (the layout must not
move while they load), plus captures for the eight card games if they are shown
individually inside the Taash tile. Use `~/.claude/scripts/shot.mjs` against the
live URLs above. Budget 45 to 60 minutes, and look at every image before calling
it done.

Blurbs and taglines come from the monorepo registry, which already has one line
per game written for exactly this purpose.

## 15. Fairness roadmap: stronger schemes, and when each earns its cost

Recorded 19 Aug 2026. **None of this is pre-launch work.** Eleven finished games
and zero players means the bottleneck is that nobody has been asked to check a
proof yet, not the strength of the proof. This section exists so the options are
written down rather than re-derived the day somebody challenges a roll.

### What exists today

Commit-reveal with client entropy and a signed attestation: a server seed
derived under a domain tag (`derive.ts:57`), combined with per-seat client seeds
(`derive.ts:113`), committed before play and revealed after, with participants
bound into an Ed25519-signed digest (`attest.ts`). That is already stronger than
nearly every casual games site, and the Ed25519 attestation is genuinely
unusual at this tier.

### Its two real weaknesses

1. **Selective abort.** Commit, watch how the game develops, kill the ones you
   dislike. Nothing in a commit-reveal scheme prevents an operator discarding
   rounds, and no published seed reveals that it happened.
2. **Self-asserted timestamps.** You publish the commitment and you also publish
   when you published it. A sceptic cannot rule out back-dating, because every
   artefact in the chain is produced by the party being trusted.

### The hard constraint any upgrade must respect

`packages/fairness` is deliberately zero-dependency with no DOM or Node types,
so the Worker, the web apps, a future React Native client and the pure logic
packages can all import it. Anything needing WASM or a heavy curve library must
live in a separate package that only the server or a verification page imports,
never in the shared derivation path.

And the version discipline: any change to derivation means a new `v3` directory
and tag, with `v2` kept alive forever to verify games already played. That is
the permanent cost of touching a hash input after launch.

### Option A: public timestamping (cheapest, best value)

Batch each day's commitments into a Merkle root and anchor the root in a public
append-only log that you do not control, such as Sigstore's Rekor, or an RFC
3161 timestamping authority.

- **Fixes:** self-asserted timestamps. "The commitment existed before the game"
  becomes provable by a third party.
- **Cost:** low. One daily job, plus an inclusion proof stored beside each game.
- **Dependency impact:** none on the shared path. Verification is ordinary
  signature and Merkle checks.
- **Verdict:** do this first, the day real players exist.

### Option B: ECVRF (RFC 9381)

A verifiable random function. For a given input, the output is uniquely
determined by your private key, and anyone can verify it with the public key.

- **Fixes:** grinding and selective abort at the seed level. You cannot produce
  two valid outputs for one input, so there is nothing to choose between.
- **Removes:** the reveal step entirely, which simplifies the ceremony.
- **Cost:** a real VRF implementation. `jose` does not provide one, so this is a
  new crypto dependency in code that must run in a Worker and a browser.
- **Verdict:** worth it only if grinding becomes an actual accusation.

### Option C: a public randomness beacon (drand)

The League of Entropy publishes threshold-signed randomness on a fixed schedule.
Commit to using round N before round N exists; when it lands, nobody can argue
you influenced it, because you were never a party to it.

- **Fixes:** everything about operator influence, completely. Strongest trust
  story available.
- **Cost:** BLS12-381 verification, which means WASM, which breaks the
  zero-dependency rule above unless quarantined. Round latency does not suit
  turn-by-turn dice.
- **Best fit:** the daily seeds, where latency is irrelevant and the story is
  excellent: today's deal comes from the League of Entropy, not from us.
- **Related:** drand timelock encryption (tlock) lets you encrypt to a future
  round, which is another route to killing abort attacks.

### Option D: player-side randomness (MPC coin flip)

Every player commits, then all reveal, and the seed is the hash of all
contributions. No trusted server at all.

- **Already half-built:** seat seeds are mixed in today via `combineOrder`.
- **Blocker:** last-revealer advantage. Whoever reveals last sees the outcome
  first and can abort. Fixing it needs verifiable secret sharing or a timelock,
  which is where this converges with Option C anyway.

### Option E: blockchain block hashes (rejected)

Commonly used and strictly worse than drand: validators and miners can influence
or withhold blocks. Records here only so it is not proposed again.

### Recommended sequence

1. Ship the studio and get players. Nothing below matters before that.
2. Public timestamping (A) once anyone cares enough to check.
3. drand (C) for daily seeds only, quarantined in its own package.
4. VRF (B) only if selective abort becomes a live accusation.

## 16. Verification: the gate this rename has to pass

The rename touches cookies, token claims, storage keys, hash inputs, four
deployments and a WebSocket host. Most of those fail **silently**: a wrong
`postMessage` source does not throw, a cookie that stops being sent just looks
like a logged-out user, and a stale registry URL 404s only for the person who
clicked it. A green `pnpm gate` proves none of it.

So this section is the real gate. Three layers, and the rename is not done until
all three are green.

### Layer 0: the baseline, captured BEFORE anything changes

Without a before, an after proves nothing. Run this on the untouched tree and
keep the output; every later check diffs against it.

```bash
mkdir -p /tmp/rename-baseline && cd ~/dev/chaupal
pnpm gate 2>&1 | tail -40 > /tmp/rename-baseline/gate.txt
node scripts/probe-rooms.mjs 2>&1 > /tmp/rename-baseline/rooms.txt
for u in https://chaupal-games.goelhome.workers.dev \
         https://judgement-cards.goelhome.workers.dev \
         https://draw-games.netlify.app \
         https://lattice-games.netlify.app \
         https://glasstablegames.goelhome.workers.dev; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$u")" "$u"
done > /tmp/rename-baseline/status.txt
```

A baseline that is already red is a baseline, not a blocker: record it, so a
failure after the rename is not blamed on the rename.

### Layer 1: `scripts/check-brand.mjs`, a gate that fails on leakage

Drop into the monorepo and add to the `test` chain beside `check:dashes`. This
is what makes every future rename mechanical rather than archaeological.

```js
// Fails the build if the studio's name leaks outside the one file that owns it.
// Prose says the studio's name; code derives it.
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const OWNED = ["packages/brand/src/index.ts"];
const PROSE = [/^docs\//, /^README\.md$/, /^CLAUDE\.md$/, /\.test\.ts$/];
const NEEDLES = [/Glass Table Games/i, /glasstablegames?/i];

const files = globSync("{packages,apps,scripts}/**/*.{ts,tsx,mjs,css,json}", {
  exclude: (p) => p.includes("node_modules") || p.includes(".next"),
});

const bad = [];
for (const file of files) {
  if (OWNED.includes(file) || PROSE.some((re) => re.test(file))) continue;
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (NEEDLES.some((re) => re.test(line))) bad.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (bad.length) {
  console.error("The studio's name is hardcoded outside packages/brand:\n" + bad.join("\n"));
  process.exit(1);
}
console.log(`check:brand ok (${files.length} files)`);
```

### Layer 2: `scripts/verify-rename.mjs`, the residual and consistency sweep

```js
// Three assertions a typechecker cannot make.
import { execSync } from "node:child_process";
import { NAMESPACE, GAMES, CARD_ROOM, STUDIO, SITE_ORIGINS } from "@glass-table/brand";

const fail = [];

// 1. Every surviving "chaupal" means the game, its URL, or a test fixture.
const ALLOWED = [/GAMES\.chaupal/, /chaupal-games\./, /chaupal\.example/, /id: "chaupal"/,
                 /name: "Chaupal"/, /open square at the centre/];
const hits = execSync(
  `grep -rIn --exclude-dir={.git,node_modules,.next,out} -i 'chaupal' packages apps scripts || true`,
  { encoding: "utf8" },
).split("\n").filter(Boolean).filter((line) => !ALLOWED.some((re) => re.test(line)));
if (hits.length) fail.push(`Unexplained 'chaupal':\n${hits.join("\n")}`);

// 2. The namespace is still a legal cookie name, storage key and JWT claim.
if (!/^[a-z][a-z0-9]*$/.test(NAMESPACE)) fail.push(`NAMESPACE illegal: ${NAMESPACE}`);

// 3. Every registry URL is under the studio domain, and origins derive cleanly.
for (const game of Object.values(GAMES)) {
  if (!game.url.startsWith("https://")) fail.push(`${game.id}: not https`);
  if (!game.url.includes(new URL(STUDIO.url).hostname.replace(/^www\./, "")))
    fail.push(`${game.id}: ${game.url} is not under ${STUDIO.url}`);
}
if (new Set(SITE_ORIGINS).size !== SITE_ORIGINS.length) fail.push("SITE_ORIGINS has duplicates");

if (fail.length) { console.error(fail.join("\n\n")); process.exit(1); }
console.log(`verify-rename ok: ${Object.keys(GAMES).length} games, ${SITE_ORIGINS.length} origins`);
```

### Layer 3: `scripts/verify-live.mjs`, end to end against the real deployments

This is the one that catches what the others cannot. Run it after every deploy.

```js
// Every assertion here is about a running system, not a build artefact.
const DOMAIN = "glasstablegames.com";
const HOSTS = ["", "chaupal.", "cards.", "draw.", "lattice.", "accounts."].map((s) => `https://${s}${DOMAIN}`);
const fail = [];
const ok = [];

for (const url of HOSTS) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    // 1. It answers, and not with the 402 that started all of this.
    if (res.status >= 400) { fail.push(`${url} -> ${res.status}`); continue; }
    const html = await res.text();

    // 2. The canonical tag points at itself, not at a dead vercel.app alias.
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (canon && !canon.includes(DOMAIN)) fail.push(`${url}: canonical still ${canon}`);

    // 3. No dead brand anywhere in the shipped HTML.
    if (/Simple Games/.test(html)) fail.push(`${url}: still says Simple Games`);
    if (/vercel\.app/.test(html)) fail.push(`${url}: still links a vercel.app host`);

    // 4. The session cookie is scoped to the parent domain, which is the whole
    //    point of the subdomain move. Host-only here means one sign-in per game.
    const cookie = res.headers.get("set-cookie") ?? "";
    if (cookie && !new RegExp(`Domain=\\.?${DOMAIN}`).test(cookie))
      fail.push(`${url}: cookie is host-only: ${cookie.split(";")[0]}`);

    ok.push(`${url} ${res.status}`);
  } catch (error) { fail.push(`${url} threw ${error.message}`); }
}

// 5. The realtime Worker answers on its custom domain over TLS.
const rt = await fetch(`https://realtime.${DOMAIN}/health`).catch((e) => ({ status: e.message }));
if (rt.status !== 200) fail.push(`realtime.${DOMAIN} -> ${rt.status}`);

// 6. A cross-origin POST from a stranger is still refused.
const hostile = await fetch(`https://chaupal.${DOMAIN}/api/identity/guest`, {
  method: "POST", headers: { origin: "https://evil.example" },
});
if (hostile.status < 400) fail.push(`CSRF: cross-origin POST accepted (${hostile.status})`);

console.log(ok.join("\n"));
if (fail.length) { console.error("\nFAILED\n" + fail.join("\n")); process.exit(1); }
```

### The two things no script can check

Both are release gates. Neither is optional.

1. **Google sign-in, clicked by a human, end to end.** `MESSAGE_SOURCE` changed
   on both sides of a `postMessage`; a mismatch fails silently and no status
   code shows it.
2. **A real room, two browsers, on two different subdomains.** Sign in on
   `chaupal.`, then open `cards.` and confirm you are still signed in. That
   single check proves the cookie `Domain`, the CSRF classifier, the Worker
   allowlist and `parseRoomId` all agree. Existing harness:
   `node scripts/smoke-room.mjs https://chaupal.glasstablegames.com` and
   `node scripts/probe-tables.mjs https://cards.glasstablegames.com`.

### Rollout order, with a stop at every gate

Staged deliberately, cheapest and least-coupled first, so a failure is caught
while only one thing has moved.

| # | Step | Gate before continuing | Rollback |
|---|---|---|---|
| 1 | Code rename, nothing deployed | `pnpm gate` + `check:brand` + `verify-rename` | `git reset --hard` |
| 2 | Deploy **Draw** only (Netlify, no accounts, lowest blast radius) | `verify-live` for `draw.` + open the site | Redeploy previous |
| 3 | Point `draw.` DNS at it | Resolve, TLS, 200, canonical | Delete the DNS record |
| 4 | Deploy the card room and Chaupal | `verify-live` for both | Redeploy previous |
| 5 | Cookie `Domain` goes to `.glasstablegames.com` | **Two-browser cross-subdomain sign-in** | Revert the one constant |
| 6 | New realtime Worker, old one left running | Two-browser room on the new host | Point env back at the old Worker |
| 7 | Delete the old Worker, retire old hostnames | 24h with no errors in observability | Redeploy it from git |

Step 6 keeping the old Worker alive is what makes this reversible. Deleting it
before a verified room is the one irreversible mistake available here.

### Acceptance: the rename is done when all of these are true

- [ ] `pnpm gate` green, including `check:brand` and `verify-rename`
- [ ] `verify-live` green against all six hostnames
- [ ] Baseline diff shows no route that was 200 before is now anything else
- [ ] Google sign-in completes, by hand
- [ ] One sign-in works across two different subdomains, by hand
- [ ] A two-browser room plays a full round on the new Worker
- [ ] A daily puzzle loads and its printed seed matches the new prefix
- [ ] The studio site's mirror test still passes untouched
- [ ] `grep -rIn -i chaupal` returns only the game, its URL, and the fixtures
- [ ] Old Worker deleted only after 24h clean
