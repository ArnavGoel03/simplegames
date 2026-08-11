import { MAKER, STUDIO_NAME, studio } from "@/lib/brand";
import { LEGAL_EMAIL } from "@/lib/legal";

export function IntellectualProperty() {
  return (
    <>
      <p className="lede">
        The games themselves belong to nobody. Ludo, Snakes and Ladders and Judgement are
        traditional games centuries older than any company, and no claim is made over the rules of
        any of them. What is owned here is the software, the names and the design.
      </p>

      <h2>1. The games are public property, and stay that way</h2>
      <p>
        Pachisi, Moksha Patam, and the trick-taking family that Judgement belongs to were not
        invented by {STUDIO_NAME} and are not claimed by it. Anyone may make their own version of
        any of them. Nothing on this site should be read as asserting a right over a traditional
        game, and no such assertion will ever be made.
      </p>

      <h2>2. The code</h2>
      <p>
        This site&rsquo;s source is{" "}
        <a href={studio.github} rel="noreferrer">
          published
        </a>{" "}
        so that the fairness claim can be checked. Published is not the same as licensed for reuse:
        copyright in the code is retained by {MAKER.name}, and no permission to copy, redistribute
        or build on it is granted by its being readable.
      </p>
      <p>
        Reading it, running it locally, and quoting it to point out that it is wrong are all fine
        and are the entire reason it is out there. If you want to use a piece of it in your own
        work, ask, and the answer will usually be yes.
      </p>

      <h2>3. The names and the look</h2>
      <p>
        {STUDIO_NAME}, Chaupal and the wordmarks, page design and written copy on this site belong
        to {MAKER.name}. Do not use them in a way that suggests a game is made by, endorsed by or
        connected to {STUDIO_NAME} when it is not.
      </p>
      <p>
        Referring to {STUDIO_NAME} by name in order to write about it, review it, criticise it or
        link to it needs no permission and never will.
      </p>

      <h2>4. Typefaces and other people&rsquo;s work</h2>
      <p>
        The typefaces used here are Fraunces and IBM Plex, both released under the SIL Open Font
        Licence by their designers. They are served from this site rather than from a font provider
        for privacy reasons, which the licence expressly allows. They remain the work of their
        authors, not of {STUDIO_NAME}.
      </p>

      <h2>5. Reporting an infringement</h2>
      <p>
        If something here infringes your copyright or trademark, write to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> and include:
      </p>
      <ul>
        <li>what the work is, and enough for it to be identified;</li>
        <li>where on this site the infringing material appears, as a link;</li>
        <li>why you believe the use is not authorised;</li>
        <li>how to reach you;</li>
        <li>
          a statement that the information is accurate and that you are the rights holder or
          authorised to act for them.
        </li>
      </ul>
      <p>
        A complete notice will be acted on promptly. There is no legal department between you and
        the person who can take the material down, which in practice makes this faster than the
        same process at a larger company.
      </p>

      <h2>6. If you think a claim against you is wrong</h2>
      <p>
        If material of yours is removed and you believe that was a mistake, say so at the same
        address. It will be looked at again by a person rather than closed by a form.
      </p>
    </>
  );
}
