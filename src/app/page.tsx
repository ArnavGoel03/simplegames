import Image from "next/image";
import Link from "next/link";
import { CardFan } from "@/components/CardFan";
import { Commitment } from "@/components/Commitment";
import { TitlePlate } from "@/components/TitlePlate";
import { GAME_COUNT_WORD, GAMES, GAMES_LINK, HERO_ART, PLAYABLE, STUDIO_TAGLINE } from "@/lib/brand";

/**
 * The three things the studio does not ask a player for. Written here rather
 * than in brand.ts because they are this page's argument, not the studio's
 * identity, and nothing else in the site repeats them.
 */
const FACTS = [
  { head: "No signup", body: "A link is the whole invitation. Send it and start." },
  { head: "No install", body: "It opens in a browser, on whatever phone is on the table." },
  { head: "No trust", body: "Every roll is committed to before it happens and published after." },
] as const;

export default function HomePage() {
  const first = PLAYABLE[0];

  return (
    <>
      <section className="stage">
        <div className="stage__copy">
          <p className="kicker">{STUDIO_TAGLINE}</p>
          <h1>Every roll is settled before we know who it helps.</h1>
          <p className="stage__lede">
            Board and card games for playing with friends. The number behind every roll and every
            shuffle is fixed before the game starts and published when it ends, so the result can be
            checked afterwards by anyone who cares to.
          </p>
          <p className="cta">
            {first ? (
              <a className="button button--large" href={first.url}>
                Play {first.name}
              </a>
            ) : null}
            <Link className="button button--large button--quiet" href="/fair-play">
              How the check works
            </Link>
          </p>
        </div>
        <div className="stage__art">
          <Image
            src={HERO_ART.src}
            alt={HERO_ART.alt}
            width={HERO_ART.width}
            height={HERO_ART.height}
            sizes="(min-width: 64rem) 60vw, 100vw"
            priority
          />
        </div>
      </section>

      <ul className="shell shell--wide facts">
        {FACTS.map((fact) => (
          <li key={fact.head}>
            <b>{fact.head}</b>
            <span>{fact.body}</span>
          </li>
        ))}
      </ul>

      <section className="shell shell--wide band band--flush" id="games">
        <h2 className="section-title">{GAME_COUNT_WORD} games in the studio.</h2>
        <div className="titles">
          {GAMES.map((game) => {
            const inner = (
              <>
                <div className="title__art">
                  {game.art ? (
                    <Image
                      src={game.art.src}
                      alt={game.art.alt}
                      width={game.art.width}
                      height={game.art.height}
                      sizes="(min-width: 60rem) 45vw, 100vw"
                    />
                  ) : game.fallback === "cards" ? (
                    <CardFan />
                  ) : (
                    <TitlePlate name={game.name} />
                  )}
                </div>
                <div className="title__body">
                  <span className="title__holds">{game.holds}</span>
                  <h3 className="title__name">{game.name}</h3>
                  <p className="title__blurb">{game.blurb}</p>
                  <span className="title__meta">{game.players}</span>
                  <span className="title__go">
                    {game.url ? `Play ${game.name}` : "In development"}
                  </span>
                </div>
              </>
            );
            return game.url ? (
              <a key={game.id} className="title" href={game.url}>
                {inner}
              </a>
            ) : (
              <div key={game.id} className="title title--soon">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <section className="shell shell--wide band">
        <div className="proof">
          <div>
            <h2 className="section-title">Nothing above is a promise. It is arithmetic.</h2>
            <div className="prose">
              <p>
                A game that says it is fair is asking to be trusted. A game that publishes the
                number it rolled from is not asking for anything, because you can run the same sum
                and get the same faces.
              </p>
              <p>
                <Link href="/fair-play">Read how the check works</Link>
              </p>
            </div>
          </div>
          <Commitment />
        </div>
      </section>

      <section className="shell shell--wide band closing">
        <h2 className="section-title">Pick a game and send the link.</h2>
        <p className="cta">
          {PLAYABLE.map((game) => (
            <a key={game.id} className="button button--large" href={game.url}>
              Play {game.name}
            </a>
          ))}
          <Link className="button button--large button--quiet" href={GAMES_LINK.path}>
            Read about them first
          </Link>
        </p>
      </section>
    </>
  );
}
