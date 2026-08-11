import Link from "next/link";
import { GAMES, STUDIO_NAME } from "@/lib/brand";
import { LEGAL_EMAIL, legalPath } from "@/lib/legal";

export function Content() {
  return (
    <>
      <p className="lede">
        {GAMES.map((game) => game.holds).join(", ")}. These are traditional games played at family
        tables, and the versions here do not add anything a family table would object to.
      </p>

      <h2>1. What is in the games</h2>
      <ul>
        <li>
          <strong>No violence</strong> of any kind, depicted or described.
        </li>
        <li>
          <strong>No sexual content</strong>, and no suggestive imagery.
        </li>
        <li>
          <strong>No gambling</strong>. Nothing is wagered, nothing is bought, and nothing that can
          be won has value outside the game. This is set out in full in the{" "}
          <Link href={legalPath("terms")}>terms of use</Link>.
        </li>
        <li>
          <strong>No advertising</strong>, no sponsored content, and no promotion of anything to
          anyone.
        </li>
        <li>
          <strong>No loot boxes, no random rewards, no streaks and no daily bonuses.</strong> There
          is no mechanic here designed to pull you back tomorrow.
        </li>
      </ul>

      <h2>2. Who the games are for</h2>
      <p>
        Anyone old enough to follow the rules. Ludo and Snakes and Ladders are played by young
        children in most of the world. Judgement asks you to count and to predict, and tends to
        make sense from roughly eight or nine upwards.
      </p>

      <h2>3. The part parents should actually know</h2>
      <p>
        There is one thing here worth a parent&rsquo;s attention, and it is not the content. It is
        that <strong>a room is shared by link</strong>. Whoever holds the link can join, and can
        choose any display name they like, including one belonging to somebody else.
      </p>
      <p>
        There is no matchmaking with strangers and no public lobby, so a child is not going to be
        put in a room with an unknown adult by the software. But a link forwarded on is a link that
        works. Treat a room link the way you would treat a video call link.
      </p>

      <h2>4. Why there is no ESRB or PEGI rating</h2>
      <p>
        ESRB, PEGI, USK, and the CBFC classify games submitted to them, and submission is
        principally how packaged and console titles reach shops and stores. These games are web
        pages. They are not sold, not distributed through a store, and not submitted to a ratings
        board, so they carry no rating badge.
      </p>
      <p>
        The absence of a badge is not a claim of anything. Section 1 is the substance a rating would
        summarise, written out rather than compressed into a letter.
      </p>

      <h2>5. Chat</h2>
      <p>
        There is no chat feature in {STUDIO_NAME} games at present. Players talk to each other by
        whatever means they already use, which is normally the same conversation the room link was
        sent in. If chat is ever added, this page changes before it ships, because it would be the
        single biggest change to what is in the games.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions about suitability, or something in a game that does not match this page, go to{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </>
  );
}
