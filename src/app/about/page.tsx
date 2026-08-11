import type { Metadata } from "next";
import { GAMES, MAKER, STUDIO_NAME, studio } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: `Who makes ${STUDIO_NAME}, and why the games are built to be checked rather than trusted.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <section className="shell band band--flush">
      <div className="prose">
        <p className="eyebrow">About</p>
        <h1>One person, two games, no house edge.</h1>
        <p>
          {STUDIO_NAME} is <strong>{MAKER.name}</strong>. There is no team, no office and no
          investor, which is worth saying plainly because a studio site that implies otherwise is
          the first small lie in a product that claims to be checkable.
        </p>

        <h2>Why it exists</h2>
        <p>
          The games people actually play with their friends, Ludo on a phone, cards at a table, all
          have online versions, and every one of them asks to be trusted about the one thing the
          game turns on. Somebody always says the dice are rigged. Usually they are wrong. Nobody
          can show them.
        </p>
        <p>
          These games answer that with arithmetic rather than reassurance. The number the game
          rolls from is fixed before play and published after, so an accusation has somewhere to
          go: run the sum, see the same faces.
        </p>

        <h2>What is here</h2>
        <p>
          {GAMES.map((game) => game.name).join(" and ")}. Both are free, both run in a browser,
          neither has an account you must make before you can play, and there is nothing to buy.
          There are no advertisements and no analytics, so nothing about your game leaves the room
          you played it in.
        </p>

        <h2>The code</h2>
        <p>
          The derivation on the home page is not a demonstration standing in for the real thing. It
          is the code the games run, and it is{" "}
          <a href={studio.github} rel="noreferrer">
            in this site&rsquo;s repository
          </a>
          , because a claim like the one here is worth only as much as the ability to go and read
          it.
        </p>
        <p>
          The game repositories themselves are not open yet. That is a gap, and saying so is
          cheaper than being caught at it.
        </p>
      </div>
    </section>
  );
}
