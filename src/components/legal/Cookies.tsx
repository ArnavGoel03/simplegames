import { STUDIO_NAME } from "@/lib/brand";
import { LEGAL_EMAIL } from "@/lib/legal";

export function Cookies() {
  return (
    <>
      <p className="lede">
        This site sets no cookies. There is no banner asking you to accept any, because there are
        none to accept, and a banner that appears anyway is just a website apologising for
        something it did not need to do.
      </p>

      <h2>1. What a cookie is, briefly</h2>
      <p>
        A cookie is a small piece of text a site asks your browser to keep and send back on your
        next visit. It is how a site remembers that you are logged in, and equally how an
        advertising network recognises you on a site you have never visited before.
      </p>

      <h2>2. What this site uses</h2>
      <p>None of it. To be specific, this site does not:</p>
      <ul>
        <li>set any cookie, of any kind, for any purpose;</li>
        <li>write to local storage or session storage;</li>
        <li>use an analytics or advertising service that would set one on its behalf;</li>
        <li>
          load any script, style, typeface, image or frame from another company, so no other
          company is in a position to set one either.
        </li>
      </ul>
      <p>
        You can confirm this rather than take it on trust. Open your browser&rsquo;s storage
        inspector on any page of this site and the cookie list is empty.
      </p>

      <h2>3. Why there is no consent banner</h2>
      <p>
        Consent rules exist so that people are asked before a site stores things on their device or
        tracks them across the web. Neither happens here, so there is nothing to ask about. The
        correct response to those rules, when you genuinely collect nothing, is silence rather than
        a dialog.
      </p>

      <h2>4. The games</h2>
      <p>
        A game may need to remember something strictly practical, such as which room you are in, so
        that a refresh mid-match does not throw you out. Where that is needed it is done with
        storage in your own browser that never leaves your device and is never read by{" "}
        {STUDIO_NAME}. It is not used to recognise you, and it is not shared.
      </p>
      <p>
        If a game ever needs a genuine cookie, it will be listed on this page by name, purpose and
        lifetime before it ships.
      </p>

      <h2>5. Contact</h2>
      <p>
        If you find a cookie on this site, that is a bug and worth reporting. Write to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </>
  );
}
