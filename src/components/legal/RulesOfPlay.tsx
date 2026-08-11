import { STUDIO_NAME } from "@/lib/brand";
import { LEGAL_EMAIL } from "@/lib/legal";

export function RulesOfPlay() {
  return (
    <>
      <p className="lede">
        A room is four people and a link. That is a small enough space that a code of conduct can be
        short and specific instead of long and vague. This is the whole of it.
      </p>

      <h2>1. Play the game honestly</h2>
      <p>
        Do not modify the client, script a player, use a second window to see what you should not
        see, or exploit a defect once you know it is a defect. The point of a game whose fairness
        can be proved is that the result means something, and each of these makes it mean nothing.
      </p>
      <p>
        Finding a defect is welcome. Reporting it is welcome. Farming it quietly is the thing this
        clause is about.
      </p>

      <h2>2. Do not attack the service</h2>
      <p>
        No flooding, no scraping, no attempt to break into a room you were not invited to, no
        probing for holes with the intent to use them, and no reverse engineering aimed at
        defeating the fairness derivation.
      </p>
      <p>
        Security research done in good faith is a different thing entirely, and is covered in
        section 6.
      </p>

      <h2>3. Be tolerable to the other three people</h2>
      <p>
        Rooms are shared by link, so the people in one usually know each other. Even so: no
        harassment, no slurs, no threats, no sexual content directed at anyone, and nothing about
        another player that they have not chosen to share.
      </p>
      <p>
        Display names are covered by this too. A name is visible to everyone in the room, and using
        one to say something you could not say out loud is the same offence with extra steps.
      </p>

      <h2>4. No stakes through the software</h2>
      <p>
        These games carry no money and are not built to carry any. Do not use a room to run a
        betting pool, do not advertise stakes in a display name, and do not present a{" "}
        {STUDIO_NAME} game as a gambling product. What you agree privately with your own friends is
        yours to agree, but it stays outside the software, and the software will never help with it.
      </p>

      <h2>5. What happens when someone does these things</h2>
      <p>
        The honest answer today is that there is no moderation team, no report button and no ban
        system, because there are no accounts to ban. What exists is the ability to shut down a
        room, to block an address, and to withdraw a game.
      </p>
      <p>
        In practice the strongest protection is the shape of the product: a room is reachable only
        by its link, so the people in it are the people you sent it to. Do not send it to someone
        you would not want in the room.
      </p>

      <h2>6. Reporting something</h2>
      <p>
        Write to <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. Security issues, cheating,
        and behaviour in a room all go to the same address, and reaching a person is usually faster
        than it would be at a company with a form.
      </p>
      <p>
        If you are reporting a security flaw, please give the person who wrote it a reasonable
        chance to fix it before publishing. Good-faith research reported that way will never be met
        with a legal threat.
      </p>
    </>
  );
}
