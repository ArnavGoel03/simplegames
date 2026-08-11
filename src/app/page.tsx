import Link from "next/link";
import { Commitment } from "@/components/Commitment";
import { GAME_COUNT_WORD, GAMES } from "@/lib/brand";

export default function HomePage() {
  return (
    <>
      <section className="shell band band--flush hero">
        <h1>Every roll and every deal is settled before we know who it helps.</h1>
        <p>
          We make board and card games for playing with friends. The number behind every roll and
          every shuffle is committed to before the game starts and published when it ends, so the
          result can be checked afterwards by anyone who cares to. Here is that happening, in your
          browser, now.
        </p>
        <Commitment />
      </section>

      <section className="shell band" id="games">
        <h2 className="section-title">{GAME_COUNT_WORD} games. No signup, no install, no app.</h2>
        <div className="games">
          {GAMES.map((game) => {
            const inner = (
              <>
                <span className="game__name">{game.name}</span>
                <span className="game__holds">{game.holds}</span>
                <span className="game__blurb">{game.blurb}</span>
                <span className="game__meta">{game.players}</span>
                <span className="game__status">
                  {game.url ? `Play ${game.name}` : "In development"}
                </span>
              </>
            );
            return game.url ? (
              <a key={game.id} className="game" href={game.url}>
                {inner}
              </a>
            ) : (
              <div key={game.id} className="game game--soon">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <section className="shell band">
        <h2 className="section-title">Nothing above is a promise. It is arithmetic.</h2>
        <div className="prose">
          <p>
            A game that says it is fair is asking to be trusted. A game that publishes the number
            it rolled from is not asking for anything, because you can run the same sum and get the
            same faces.
          </p>
          <p>
            <Link href="/fair-play">Read how the check works</Link>
          </p>
        </div>
      </section>
    </>
  );
}
