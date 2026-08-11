import Link from "next/link";
import { STUDIO_NAME, studio } from "@/lib/brand";
import { LEGAL_EMAIL, legalPath } from "@/lib/legal";

export function Privacy() {
  return (
    <>
      <p className="lede">
        {STUDIO_NAME} collects nothing about you. Not an email address, not a name, not an
        analytics event, not a cookie. This page explains what that means, and is honest about the
        one thing that happens anyway because every website on the internet is hosted somewhere.
      </p>

      <h2>1. What this site collects</h2>
      <p>Nothing. Specifically, and in the order people usually ask:</p>
      <ul>
        <li>
          <strong>No analytics.</strong> There is no Google Analytics, no Vercel Analytics, no
          Plausible, no pixel, no beacon and no session recorder. Nothing counts your visit.
        </li>
        <li>
          <strong>No cookies.</strong> This site sets none at all. See the{" "}
          <Link href={legalPath("cookies")}>cookies page</Link>, which is short for that reason.
        </li>
        <li>
          <strong>No third-party requests.</strong> The typefaces are served from this site rather
          than from a font provider, so no font provider learns that you were here. There is no
          embedded video, no map, no social widget and no advertising network.
        </li>
        <li>
          <strong>No account.</strong> There is nothing to sign up for, so there is no email address
          to lose.
        </li>
      </ul>
      <p>
        This is checkable rather than promised. Open your browser&rsquo;s network panel and reload
        the page: every request goes to this site&rsquo;s own address, and the content security
        policy served with the page forbids the browser from contacting anywhere else even if a
        mistake were made in the code.
      </p>

      <h2>2. What the hosting provider sees</h2>
      <p>
        This site is hosted on Vercel, and the games are served the same way. Like every web host,
        Vercel handles the request your browser makes in order to answer it, and keeps operational
        logs that can include your IP address, the page you asked for, the time, and your browser
        and device type.
      </p>
      <p>
        That is the hosting provider acting as an infrastructure operator, not {STUDIO_NAME}{" "}
        gathering data. It is not linked to a name, not used to build a profile, not sold, and not
        read by anyone here in the ordinary course of running the site. It is mentioned because a
        privacy policy that claimed no data existed anywhere would be false, and this one is meant
        to survive being checked.
      </p>

      <h2>3. What a game room holds while you play</h2>
      <p>
        When you play with friends, the room holds what it needs to run the game and nothing more:
        the display name you typed, the position of the pieces or the state of the hands, and the
        fairness values that let the result be verified afterwards.
      </p>
      <p>
        A display name is whatever you type. It is not verified, not required to be your real name,
        and there is no reason to make it one. Room state is transient. When a room ends, it goes.
      </p>

      <h2>4. Children</h2>
      <p>
        No personal information is knowingly collected from anyone, which includes children. There
        is no sign-up form to collect it with. Parents should read the{" "}
        <Link href={legalPath("content")}>content and age page</Link>, which describes what is
        actually in the
        games and the one part worth knowing about: rooms are shared by link, so a child plays with
        whoever holds the link.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Data protection law gives you rights to see, correct, export and delete what an
        organisation holds about you. Those rights are honoured here, and honouring them is
        unusually simple: there is nothing held, so there is nothing to produce and nothing to
        erase.
      </p>
      <p>
        If you believe that is wrong and something about you is held here, write to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> and it will be looked into properly
        rather than answered with this paragraph.
      </p>

      <h2>6. If this ever changes</h2>
      <p>
        Adding accounts, or analytics, or anything that stores something about you, would make most
        of this page false. If that day comes, this page is rewritten before the feature ships, not
        after, and the effective date at the top changes.
      </p>
      <p>
        There is no mailing list to announce it on, which is a direct consequence of collecting no
        email addresses.{" "}
        <a href={studio.github} rel="noreferrer">
          The repository
        </a>{" "}
        carries the full history of this page, so a quiet edit is not possible.
      </p>

      <h2>7. Contact</h2>
      <p>
        Privacy questions and requests go to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </>
  );
}
