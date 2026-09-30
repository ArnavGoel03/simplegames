import Link from "next/link";
import { studio } from "@/lib/brand";
import { LEGAL_EMAIL, legalPath } from "@/lib/legal";

export function Privacy() {
  return (
    <>
      <p className="lede">
        This studio site has no account form or analytics. The games can keep guest identities,
        optional account details, game records and diagnostic reports. This page explains the
        difference between the studio site and the games.
      </p>

      <h2>1. What this site collects</h2>
      <p>The studio site itself has:</p>
      <ul>
        <li>
          <strong>No analytics.</strong> There is no Google Analytics, no Vercel Analytics, no
          Plausible, no pixel, no beacon and no session recorder.
        </li>
        <li>
          <strong>No cookies.</strong> This site sets none itself. Game session cookies can also be sent to this shared domain. See the{" "}
          <Link href={legalPath("cookies")}>cookies page</Link>.
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

      <p>
        The studio does not send automatic diagnostic reports. Earlier versions could send
        failure reports with device information and a random session identifier. The current
        version removes its local queue without sending it, and the retired studio endpoint no
        longer accepts or forwards reports. This does not erase reports already stored by the
        games&rsquo; diagnostic service.
      </p>

      <h2>2. What the hosting provider sees</h2>
      <p>
        This site and the games are hosted on Cloudflare. The hosting provider processes requests
        to serve them, including network information such as your IP address, requested page and
        browser information. Hosting and operational logs are separate from the studio&rsquo;s absence
        of analytics.
      </p>

      <h2>3. What the games can store</h2>
      <p>
        Games can create a guest player record and session before you register. Player records
        include a display name, avatar identifier and activity timestamps. Optional signup adds
        an email address and password hash. Google sign-in can supply an account identifier,
        email address and display name.
      </p>
      <p>
        Multiplayer room state is stored on the server. In Charade, that can include drawings
        and messages. Supported completed games can be archived and linked to player records.
        Ending a room does not erase a player&rsquo;s identity or archived results. Account Casino
        play can store play-money balances, ledger entries, round actions, results and fairness
        proofs. Practice play runs in your browser.
      </p>
      <p>
        Games can send diagnostic reports when failures occur. Reports can include a random
        session identifier, error information, device information, recent game events and,
        where supported, replay data. Reports can be queued in browser storage for delivery.
        This studio&rsquo;s reporting change does not disable reporting in the games.
      </p>

      <h2>4. Children</h2>
      <p>
        The collection described above can apply when a child plays too. Parents should read the{" "}
        <Link href={legalPath("content")}>content and age page</Link>, which describes what is
        actually in the
        games and the one part worth knowing about: rooms are shared by link, so a child plays with
        whoever holds the link.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Data protection law gives you rights to see, correct, export and delete what an
        organisation holds about you.
      </p>
      <p>
        For privacy questions and requests, write to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>

      <h2>6. Changes to this page</h2>
      <p>
        Changes to what the studio and games collect or store will be described here, with an
        updated date. <a href={studio.github} rel="noreferrer">The repository</a> carries the
        history of this page.
      </p>

      <h2>7. Contact</h2>
      <p>
        Privacy questions and requests go to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </>
  );
}
