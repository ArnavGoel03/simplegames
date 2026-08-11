import Link from "next/link";
import { GAMES, STUDIO_NAME, studio } from "@/lib/brand";
import { JURISDICTION, LEGAL_EMAIL, legalPath } from "@/lib/legal";

export function Terms() {
  return (
    <>
      <p className="lede">
        {STUDIO_NAME} makes {GAMES.map((game) => game.name).join(" and ")}. Both are free, both run
        in a web browser, and there is nothing to buy. These terms are the agreement between you
        and {STUDIO_NAME} when you use either of them or this site.
      </p>

      <h2>1. What you are agreeing to</h2>
      <p>
        By opening a game or a room, you accept these terms. If you do not accept them, do not use
        the games. That is the whole of the bargain, and it costs you nothing to decline, because
        the games cost nothing to begin with.
      </p>
      <p>
        You must be old enough to enter an agreement where you live, or have the permission of a
        parent or guardian who is. Nothing on this site is designed to be harmful to a child, and
        the content page sets out what is actually in the games.
      </p>

      <h2>2. No money is involved</h2>
      <p>
        This is the most important clause here, so it is stated plainly and without exceptions:
      </p>
      <ul>
        <li>There is nothing to buy. No purchase, subscription, pass or upgrade exists.</li>
        <li>There is no virtual currency, no chips, no tokens and no in-game economy.</li>
        <li>
          Nothing you can win in a game has value outside the game, and nothing can be cashed out,
          traded, transferred or redeemed for anything at all.
        </li>
        <li>
          {STUDIO_NAME} does not operate, host, facilitate or take a share of any wager. If you
          agree stakes with your friends privately, that is entirely between you and them, it
          happens outside the software, and {STUDIO_NAME} is not a party to it and takes no cut.
        </li>
      </ul>
      <p>
        These games are played for their own sake. They are not gambling products, and the fairness
        proof exists to settle arguments between friends, not to underwrite a bet.
      </p>
      <p>
        If that ever changes, it changes here first. Real stakes would require age verification,
        exclusions by territory, identity checks and a licence in most places that regulate this,
        and none of those exist today. Until this clause is rewritten, assume no money.
      </p>

      <h2>3. Accounts</h2>
      <p>
        You do not need an account to play. A room asks for a display name so the other players can
        tell who is who; that name lives as long as the room does and is not an account.
      </p>
      <p>
        If accounts are introduced later, they will be introduced across {STUDIO_NAME} as a whole
        rather than per game, and you will be told what they store before you are asked to make
        one.
      </p>

      <h2>4. What is promised, and what is not</h2>
      <p>
        One thing is promised precisely. The number every roll and every deal is derived from is
        committed to before play and published after it, and the derivation is arithmetic anyone
        can repeat. That claim is testable, and{" "}
        <a href={studio.github} rel="noreferrer">
          the code that makes it
        </a>{" "}
        is published so it can be tested.
      </p>
      <p>
        Nothing else is promised. The games are provided as they are. There is no guarantee that a
        game will be available, that a room will stay up, that a match will finish, or that the
        software is free of defects. It is free software given away by one person, and it should be
        relied on accordingly.
      </p>
      <p>
        To the extent the law allows, {STUDIO_NAME} excludes all warranties that are not written
        down here, and is not liable for loss that follows from using or being unable to use the
        games. Nothing in these terms limits liability for death or personal injury caused by
        negligence, for fraud, or for anything else that cannot lawfully be excluded.
      </p>

      <h2>5. What you may not do</h2>
      <p>
        The <Link href={legalPath("rules-of-play")}>rules of play</Link> set this out in full. In short: do not
        cheat, do not automate a player, do not attack the service, and do not make a room unpleasant
        for the people in it.
      </p>

      <h2>6. Changing or withdrawing a game</h2>
      <p>
        Games may be changed, paused or withdrawn at any time, including permanently. Since nothing
        was paid and nothing of value is stored, this costs you nothing but a game you liked, which
        is a real loss and not one worth pretending away.
      </p>

      <h2>7. Changes to these terms</h2>
      <p>
        These terms may change. The effective date at the top of this page changes with them. There
        is no mailing list to notify, because no email addresses are collected, so the date is the
        notice.
      </p>

      <h2>8. Governing law</h2>
      {JURISDICTION ? (
        <p>
          These terms are governed by the law of {JURISDICTION}, and the courts of {JURISDICTION}{" "}
          have exclusive jurisdiction over any dispute arising from them.
        </p>
      ) : (
        <p>
          No governing law is stated yet, and naming one at random would be worse than naming none.
          Your own local consumer law therefore applies to you in the ordinary way, and nothing here
          asks you to give it up. A jurisdiction will be named here before {STUDIO_NAME} takes any
          payment, opens any account, or offers the games to anyone beyond a circle of friends.
        </p>
      )}

      <h2>9. Reaching a person</h2>
      <p>
        Write to <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. It reaches the one person who
        makes these games.
      </p>
    </>
  );
}
