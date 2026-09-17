# Proposed corrections to published studio claims

Draft for approval, not applied. Verified against the clean `main` source in
`/Users/arnavgoel/dev/chaupal-cards` on 13 September 2026. Source proves these
features exist; live configuration and account availability must also be checked
before describing a particular deployment. No mailbox, governing jurisdiction,
data-deletion promise or fixed retention deadline has been invented.

## Privacy and About

Replace the Privacy opening paragraph with:

> This studio site has no account form or analytics. The games can keep a guest
> identity, optional account details, game records and diagnostic reports. This
> page explains what the studio site and games store.

Keep the studio-specific list in Privacy section 1. Replace "Nothing counts your
visit" with nothing, leaving the named analytics-service denial in place. Replace
the two Vercel references in section 2 with Cloudflare. After that section add:

> The games also use a database for player identities, credentials, friendships,
> game records and diagnostic reports.

Replace Privacy section 3's two paragraphs with:

> Games can create a guest player record before you register. That record includes
> a display name, an avatar identifier and activity timestamps. Optional signup
> adds an email address and a password hash. Google sign-in can supply a Google
> account identifier, email address and display name.
>
> Multiplayer room state is stored on the server so a room can survive periods of
> inactivity. In Charade, that includes drawing data. Supported completed matches
> can also be saved in the game archive and linked to player records. Ending a
> room does not erase a player's identity or archived results.
>
> Production games send diagnostic reports when errors occur. These can include
> error messages, stack traces, device information, recent game events and, for
> supported board games, replay data. Reports can be queued in browser storage
> until delivery succeeds. Reports older than 30 days are eligible for deletion
> when the diagnostics page is opened; this is not a guaranteed deletion deadline.

Replace Privacy section 4's opening two sentences with:

> The collection described above can apply when a child plays too. Parents should
> read the content and age page before sharing a game.

Retain its existing link to the Content page. Replace Privacy section 5's first
paragraph with its existing first sentence alone:

> Data protection law gives you rights to see, correct, export and delete what an
> organisation holds about you.

Keep the following contact paragraph, subject to confirming the mailbox works.
Replace section 6's first paragraph with:

> Changes to what the games collect or store will be described here, with an
> updated date.

Delete "which is a direct consequence of collecting no email addresses" from
the following paragraph. Keep its repository-history statement.

In About, replace the sentence claiming nothing leaves the room with:

> The games can retain player records and completed matches, and send diagnostic
> reports when errors occur. The privacy page describes this in detail.

Proof:

- `chaupal-cards/packages/studio/src/server/routes/guest.ts:78` creates a durable
  guest; `packages/db/src/players.ts:42` inserts it; `packages/db/src/schema.ts:42`
  includes names, avatar seeds and activity timestamps.
- `packages/studio/src/server/routes/sign-up.ts:110` attaches email/password
  credentials; `packages/studio/src/server/routes/google.ts:370` and `:392`
  record Google identity and email.
- `apps/realtime/src/room.ts:1198` writes room state;
  `apps/realtime/src/draw-room.ts:460` writes drawing-room state and `:513` writes
  canvas chunks.
- `apps/realtime/src/room.ts:4232` invokes the archive writer;
  `apps/realtime/src/archive.ts:285` posts completed-game records when configured.
- `packages/studio/src/diagnostics/Diagnostics.tsx:47` mounts reporting;
  `packages/diagnostics/src/client.ts:106` constructs reports;
  `packages/diagnostics/src/queue.ts:56` stores the queue and `:97` delivers it;
  `packages/studio/src/server/routes/diagnostics.ts:176` inserts reports.
- `packages/db/src/diagnostics.ts:54` and `:78` implement read-triggered pruning,
  not guaranteed scheduled deletion.
- Studio `wrangler.jsonc` and game app Wrangler configurations identify Cloudflare.

## Cookies

Keep the studio's no-cookie statement. The no-localStorage/no-sessionStorage statement is inaccurate: recovery uses session storage, and the telemetry retirement removes its earlier local queue. Use the 17 September replacement below.
Replace section 3's broad denial of device storage with:

> This studio site stores cached pages and assets in your browser so previously
> visited content can be available offline. The cache is not used for advertising
> or tracking.

Replace section 4 with:

> Games use browser storage for practical features including saved games,
> preferences, streaks and queued diagnostic reports. Some stored values are sent
> to the server to reconnect a player or deliver a report.
>
> The games use `glasstable-session` to identify a guest or signed-in player, and
> `glasstable-session-here` to tell the browser that a session exists. Both have a
> maximum age of 180 days when issued and can be renewed. `glasstable-google` is a
> temporary cookie for Google sign-in with a maximum age of 10 minutes.

Proof: studio `public/sw.js` opens and populates Cache Storage. Game
`packages/identity/src/session.ts:11`, `:31`, `:101` and `:121` define the two
session cookies; `packages/identity/src/tokens.ts:32` defines 180 days;
`packages/brand/src/index.ts:50` and `:387` derive their names;
`packages/studio/src/server/routes/google.ts:71` and `:74` define the Google
cookie and lifetime. `packages/studio/src/server/session.ts:85` writes the
cookies. The guest route calls `establishSession`, so cookies are not limited
to registered accounts. Diagnostics queue evidence is listed above.

## Legal index and Terms

Replace the legal index's short-version paragraph with:

> The short version: the games are free and no money is involved. The documents
> below explain the games' accounts, storage, privacy and rules of play.

Replace the Privacy summary in `src/lib/legal.ts` with:

> What the studio site and games collect and store, and what their hosting
> provider sees.

Replace Terms section 3 with:

> You do not need to register an account to play. Games can create a guest player
> record and session cookie. You can optionally register or sign in to keep an
> account across supported games. The privacy and cookies pages explain what is
> stored.

In Terms section 7, delete "because no email addresses are collected". In its
null-jurisdiction clause, remove the final sentence promising a jurisdiction
before accounts exist. Retain the existing statement that no governing law is
stated, without choosing one.

Proof: guest/signup/session paths above. This proposal changes no commercial
terms and selects no governing jurisdiction.

## Content and Rules of play

Replace Content section 5's no-chat paragraph with:

> Charade includes player drawings and a text box for guesses and chat. What other
> players draw or type can include content the studio did not create. A shared
> room link can be forwarded, so parents should consider who may join.

Introduce the Content section 1 list with:

> The following describes content supplied by the studio. Player drawings,
> display names and messages are not guaranteed to meet these descriptions.

Replace the list item denying streaks and daily mechanics with:

> No loot boxes or purchases. Some games include daily challenges and streaks
> saved in your browser.

Replace the Rules of play opening "A room is four people and a link" with:

> A room is a group of players and a link.

Replace its section 3 heading with:

> 3. Be tolerable to the other players

Replace section 5's first sentence, which denies accounts and a report button,
with the existing following sentence:

> What exists is the ability to shut down a room, to block an address, and to
> withdraw a game.

Proof: `apps/realtime/src/draw-room.ts:1449` handles arbitrary text and `:1458`
and `:1464` broadcast chat; `apps/web/src/app/daily/page.tsx:41` explicitly
describes streak storage. `packages/studio/src/report/ReportIssue.tsx` provides
a report feature; identity/account paths are above. The presence of account
banning fields alone is not proof of an operational moderation service, so the
replacement does not promise one. A matchmaking implementation exists server-side,
but I did not establish an exposed player entry point and have not proposed
changing the no-matchmaking statement on that basis alone.

## Public source claim

In Fair play, replace "The source is public, which is the only reason our word is
worth anything on it" with the exact existing About text:

> The game repositories themselves are not open yet. That is a gap, and saying
> so is cheaper than being caught at it.

Proof: `src/app/about/page.tsx` already publishes this distinction; the linked
studio repository contains the derivation, not the server's hand-redaction code.

## Publication follow-up

Set `updated` dates for every legal document whose substance changes. Do not
publish while its contact route is known to be unreachable. Mailbox existence
has not been independently verified during this audit; old documents call it
pending. The larger legal corrections above remain proposed, not applied.

## Casino and account-data addendum, 13 September 2026

Proposed only, not applied. This addendum describes the current local release
work in `gtg-teen-patti`, not the older clean `main` source cited above. Confirm
release verification before publishing it. No real-money feature, legal age,
jurisdiction, retention deadline, staffed support service or response time is
being proposed or asserted.

Add to Privacy's account/game records section:

> Casino practice runs in your browser. Account play stores your play-money
> balance, reserved chips, ledger entries, game choices, bets, actions and
> results. It also stores the commitments and random seeds used to verify a
> round after it ends. Your private round state is not sent to other players.
>
> A report you send from a table can include the game name, your seat, the room
> ID and an available completed-game ID. These help us locate the reported
> game. The report form does not attach a private card hand or a live random seed.

Add to Terms' description of play money:

> Casino games use play money. Chips have no monetary value. There are no
> deposits, chip purchases or cash-outs.

Add to the Content page:

> Casino includes simulations of Teen Patti, roulette, blackjack, slots and
> other casino games. They involve simulated betting and gambling themes, even
> though no real money is involved.

The owner must decide whether additional age/content controls or jurisdictional
language are needed. No age limit or legal conclusion has been invented here.

Add to Fair play, distinguishing account Casino from shared room ceremonies:

> For account Casino rounds, the server commits to its random seed before your
> browser supplies a client seed. The server keeps the seed and undealt cards
> private while the round is active. When the round ends, the proof can replay
> its cards, random results, actions and payout under the recorded rules.
> Practice uses the same rules engine in your browser.

This describes the implemented verification mechanism, not an independent
certification, guaranteed profitability or a claim that software cannot fail.
Do not replace the existing shared-room explanation with this single-player
protocol.

After the account export/deletion controls are released, propose replacing the
contact-only account-data paragraph with:

> You can download your account data or request account deletion from the
> account page. Finish active games before deleting the account. Deletion removes
> sign-in details, profile details, friendships, ratings, play-money records and
> account Casino rounds. Shared game archives retain a seat reference without
> your profile details so other players' game histories still work. Deletion
> does not erase other players' copies of shared games, infrastructure logs or
> backups immediately. The deleted account cannot be restored.

The retained seat reference is pseudonymous. Removing profile details does not
prove that a past opponent cannot identify a seat. Backup/log retention remains
an operational decision; the sentence above deliberately promises no deadline.
Diagnostic reports have separate session IDs and are subject to the diagnostic
retention process, not an asserted account-wide erasure guarantee.

Proposed account-control slots (the component currently defaults to empty text):

| Slot | Proposed wording |
| --- | --- |
| `exportLabel` | Download account data |
| `deleteLabel` | Delete account |
| `confirmLabel` | Delete account |
| `cancelLabel` | Cancel |
| `confirmation` | Finish your current games before deleting this account. This removes your sign-in details, profile, play-money balance and account-linked records. Shared game archives keep a seat reference without your profile details. This account cannot be restored. |

Evidence, relative to `gtg-teen-patti`:

- `packages/casino/src/view.ts`, `engine.ts` and `rules.ts` implement the shared
  rules and terminal proof. `packages/studio/src/server/routes/casino.ts` binds
  rounds to the session and commits before accepting client entropy.
- `packages/db/src/casino.ts` and chip/casino migration functions own durable
  rounds, reservations, commands and atomic settlement. No payment API exists
  in this feature.
- `apps/teen-patti/src/components/casino/usePracticeCasino.ts` keeps practice
  state locally; the account hook uses the authenticated server routes.
- `packages/studio/src/report/ReportIssue.tsx` and
  `packages/diagnostics/src/client.ts` attach bounded IDs to a manual report.
  The Teen layout now mounts the existing diagnostics provider.
- `packages/studio/src/server/routes/account-data.ts` and
  `packages/db/src/account-data.ts` provide bounded account exports. Casino
  records use the same redacted response helper as gameplay; active seeds and
  shoes are not exported. `packages/db/drizzle/0012_account_deletion.sql`
  implements deletion and preserves the non-profile seat reference.
- Account/session and realtime revocation integration, final gates, migration
  and live behavior must be verified before enabling the proposed controls.
- `gtg-teen-patti/docs/SUPPORT-READINESS-2026-09-13.md` records the actual intake,
  protected triage, opportunistic retention and unverified mailbox/coverage gaps.

## 17 September audit corrections for approval

These replacements remain proposed, not published. The telemetry fix removes
the studio reporter and its stored queue; it does not change game account or
diagnostic behaviour. The live studio still served source `bdd9c16` on this
audit's initial HTTP read. PR16 is now merged into main as `bef637a`.

Replace Cookies section 2's storage bullet with:

> use browser storage for advertising or tracking;

After its list, add:

> This studio caches pages and assets for offline use. If a required asset fails,
> it can save a temporary recovery marker in session storage to avoid repeated
> reloads. This marker is not an account identifier or an analytics record.
> Earlier studio versions could queue automatic diagnostic reports in local
> storage. The current version removes that queue without sending its contents.

Replace Privacy section 2's two Vercel references with Cloudflare. In the
opening, use the existing proposed studio/game distinction above, then add:

> The studio does not send automatic diagnostic reports. Earlier versions could
> send reports about failures, including device information and a random session
> identifier. The retired studio endpoint no longer accepts or forwards them.
> This change does not erase reports already stored by the games' diagnostic
> service.

Replace Terms section 2's stand-alone "No real money" item with the existing
Casino addendum's exact wording:

> Casino games use play money. Chips have no monetary value. There are no
> deposits, chip purchases or cash-outs.

Do not restore the old "no virtual currency, no chips, no tokens and no in-game
economy" sentence: it conflicts with Casino's current functionality. The
remaining account, retention, hosting and game-cookie corrections above must be
reviewed as one set before publishing a policy that covers the games. Public
source availability is already distinguished in the Fair play and About pages;
the Terms claim that the server implementation is published also needs deletion.
Replace that entire Terms section 4 opening paragraph with the following:

> Supported games publish a fairness proof after play. The Fair play page
> explains what can be checked and what the proof does not cover.

This proposed sentence deliberately makes no new claim that every Casino or
room protocol is identical. It requires the Fair play page to retain the
distinction between room ceremonies and account Casino from the existing
addendum.

Evidence for these studio-specific corrections: `src/lib/pwa/asset-recovery.ts`
uses `gtg-asset-recovery` in session storage for reload limits;
`src/lib/pwa-privacy.ts` deletes only the legacy diagnostic queue;
`src/app/api/diagnostics/route.ts` returns 410 without reading the request;
`tools/generate-worker.mjs` no longer injects the reporter; `wrangler.jsonc`
defines Cloudflare hosting. Existing game evidence and caveats remain above.

No mailbox availability, jurisdiction, retention deadline or historical-data
deletion has been verified or invented. Before publishing, confirm current game
features and host configuration, apply the approved replacements together, and
update each affected legal document's date.
