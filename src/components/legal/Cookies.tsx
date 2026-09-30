import { LEGAL_EMAIL } from "@/lib/legal";

export function Cookies() {
  return (
    <>
      <p className="lede">
        This studio site does not set cookies itself. The games use session cookies and browser
        storage. A game cookie scoped to the shared domain can also be sent when you visit the
        studio site.
      </p>

      <h2>1. What a cookie is, briefly</h2>
      <p>
        A cookie is a small piece of text a site asks your browser to keep and send back on your
        next visit. It is how a site remembers that you are logged in, and equally how an
        advertising network recognises you on a site you have never visited before.
      </p>

      <h2>2. What this studio site uses</h2>
      <p>
        The studio does not use an analytics or advertising service. Its pages, typefaces,
        images and scripts are served from this site.
      </p>
      <p>
        The studio caches pages and assets for offline use. If a required asset fails, it can
        save a temporary recovery marker in session storage to avoid repeated reloads. This
        marker is not an account identifier or an analytics record. Earlier studio versions
        could queue diagnostic reports in local storage; the current version removes that
        queue without sending its contents.
      </p>

      <h2>3. Checking browser storage</h2>
      <p>
        You can inspect cookies, session storage, local storage and cached assets in your
        browser&rsquo;s storage inspector. Game cookies scoped to the shared domain may appear on
        the studio site even though the studio does not set them.
      </p>

      <h2>4. The games</h2>
      <p>
        Games use browser storage for practical features including saved games, preferences,
        streaks and queued diagnostic reports. Some stored values are sent to the server to
        reconnect a player or deliver a report.
      </p>
      <p>
        Games use <code>glasstable-session</code> to identify a guest or signed-in player, and{" "}
        <code>glasstable-session-here</code> to tell the browser that a session exists. Both have
        a maximum age of 180 days when issued and can be renewed. The{" "}
        <code>glasstable-google</code> cookie is temporary state for Google sign-in, with a
        maximum age of 10 minutes. Browser expiry does not by itself erase server records.
      </p>

      <h2>5. Contact</h2>
      <p>
        Cookie and browser-storage questions can be sent to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </>
  );
}
