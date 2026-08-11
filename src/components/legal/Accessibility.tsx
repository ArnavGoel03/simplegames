import { STUDIO_NAME } from "@/lib/brand";
import { LEGAL_EMAIL } from "@/lib/legal";

export function Accessibility() {
  return (
    <>
      <p className="lede">
        The target is WCAG 2.2 at level AA. This page says what has been built deliberately, what
        has genuinely been tested, and what has not, because an accessibility statement that only
        lists successes is a marketing page wearing a compliance hat.
      </p>

      <h2>1. What has been built for</h2>
      <ul>
        <li>
          <strong>Keyboard.</strong> Everything that can be operated with a mouse can be operated
          with a keyboard, and the focus outline is visible rather than removed for looking untidy.
        </li>
        <li>
          <strong>Structure.</strong> Real headings in order, real buttons and links rather than
          styled divs, real landmarks, so a screen reader can navigate the page instead of reading
          it top to bottom.
        </li>
        <li>
          <strong>Contrast.</strong> Text is set against its background to meet the AA ratio in both
          the light and dark appearance, including the small monospaced type used for hashes.
        </li>
        <li>
          <strong>Reduced motion.</strong> If your system asks for less motion, animation is
          dropped rather than merely slowed.
        </li>
        <li>
          <strong>Colour is never the only signal.</strong> A dice result, a verified match and a
          failed check each say what they are in words as well as in colour.
        </li>
        <li>
          <strong>Zoom and reflow.</strong> The page works at 200 per cent zoom and down to a 320
          pixel viewport without a horizontal scrollbar.
        </li>
        <li>
          <strong>Text.</strong> No text is baked into an image, so it can all be resized,
          re-coloured and read aloud.
        </li>
      </ul>

      <h2>2. What has not been tested</h2>
      <p>Stated plainly, because these are the gaps most likely to affect you:</p>
      <ul>
        <li>
          No formal audit has been carried out by anyone other than the person who wrote the site.
        </li>
        <li>
          Screen reader testing has not covered every combination. JAWS on Windows and TalkBack on
          Android in particular have not been exercised properly.
        </li>
        <li>
          The games themselves are a harder problem than this site. A board with moving pieces and a
          hand of cards need announcements that are useful rather than exhaustive, and that work is
          not finished.
        </li>
        <li>Switch control and voice control have not been tested at all.</li>
      </ul>

      <h2>3. Where the games stand</h2>
      <p>
        {STUDIO_NAME} games are built in the same way as this site and inherit its keyboard and
        contrast work, but a real-time game with hidden information raises questions a static page
        does not: when to interrupt a player with an announcement, how to convey a board position
        without reading out thirty squares, and how to make a timed turn fair to someone using a
        screen reader.
      </p>
      <p>
        Those questions are open. They are not being treated as a polish item to reach after
        launch.
      </p>

      <h2>4. Telling us something is unusable</h2>
      <p>
        Write to <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. Say what you were trying to
        do, what happened, and what you were using, and it will be treated as a defect rather than a
        request.
      </p>
      <p>
        There is no dedicated accessibility team to escalate to. There is one person, which means a
        reply comes from someone who can actually fix it.
      </p>
    </>
  );
}
