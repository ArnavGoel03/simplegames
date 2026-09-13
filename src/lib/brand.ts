import palette from "./palette.json";
import catalogue from "./game-catalogue.json";

// The studio, authored once.
//
// Anything that names the studio, addresses it, or describes it to a machine
// reads from here: metadata, structured data, the sitemap, share cards, the
// header, the footer. A second copy of any of these is a bug, because copies
// drift silently and the wrong one is usually the one a crawler read.

/*
  There is no STUDIO_ID here, deliberately.

  This file used to carry one, described as the issuer and audience stamped
  into every session token. That was never true of this site, which has no
  accounts and issues nothing, and it stopped being true of the studio on
  20 August 2026, when the games rotated their namespace to `glasstable`.
  A frozen wire identifier belongs to the code that signs with it, which is
  `NAMESPACE` in the games monorepo's `packages/brand`. A second copy over
  here could only ever be a copy that disagrees, and for a while it was.
*/

export const STUDIO_NAME = "Glass Table Games";

/**
 * What the studio does, in the fewest words that are still true. Not a slogan:
 * it appears as the page title suffix and in search results, where a slogan
 * reads as noise and a description reads as an answer.
 */
export const STUDIO_TAGLINE = "Games you can check";

export const STUDIO_DESCRIPTION =
  "Glass Table Games builds board and card games for playing with friends. Every roll is committed to before it happens and published afterwards, so nobody has to take our word for it.";

function resolveUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  // The studio's own domain, registered 19 August 2026. Before it there was a
  // Vercel address, then a workers.dev one after that account was blocked for
  // bandwidth and every site on it began answering `402`. Both were stopgaps
  // and both are still reachable; this is the address the site claims as its
  // own, so it is the one every canonical tag, share card and sitemap entry is
  // built from.
  return "https://glasstablegames.com";
}

export const studio = {
  name: STUDIO_NAME,
  tagline: STUDIO_TAGLINE,
  description: STUDIO_DESCRIPTION,
  url: resolveUrl(),
  locale: "en_IN",
  lang: "en",
  // This site's own source, not the profile page. The about page points a
  // reader here to check the derivation, so it has to land on the repository
  // that actually contains src/lib/fairness.ts.
  github: "https://github.com/ArnavGoel03/simplegames",
  // The browser chrome above the page, so each one has to be the page's own
  // ground colour: --paper in globals.css, in each scheme. A single value here
  // is a bug rather than a simplification, because the page follows the
  // reader's colour scheme and one value means a light band above a dark page
  // on half the phones that open it.
  themeColor: {
    light: palette.light.paper,
    dark: palette.dark.paper,
  },
} as const;

/**
 * Every route this site has, and the label each one carries in navigation.
 *
 * The header, the footer and the sitemap all read from here, so a route that
 * gets renamed cannot be left stale in one of the three.
 */
export const ROUTES = [
  { path: "/", label: "Home", inNav: false },
  { path: "/fair-play", label: "Fair play", inNav: true },
  { path: "/about", label: "About", inNav: true },
] as const;

export const NAV = ROUTES.filter((route) => route.inNav);

/**
 * The games section of the home page.
 *
 * A fragment rather than a route, so it is deliberately not in ROUTES: the
 * sitemap is built from that list and an anchor is not a page. It carries a
 * label anyway, because the header sets it beside the real routes and a nav
 * label written twice is a nav label that will disagree with itself.
 */
export const GAMES_LINK = { path: "/#games", label: "Games" } as const;

/**
 * Who is accountable for the work. One click deep, never fabricated.
 *
 * There is deliberately no location. An unstated one is honest; a stale one is
 * a small lie on a site whose entire argument is that it does not ask to be
 * taken on faith.
 */
export const MAKER = {
  name: "Arnav Goel",
} as const;

export type GameStatus = "live" | "building";

/**
 * Key art for a game.
 *
 * Every one of these is a capture of the rendered game, cropped for the
 * gallery. Reproducible fixture captures and their provenance are recorded in
 * docs/STUDIO-DESIGN-2026-09-13.md. A studio page that shows art the game does not match is making a
 * claim it cannot keep, which is the one thing this site is not allowed to do.
 * Dimensions are carried because the layout must not move while they load.
 */
export interface GameArt {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface Game {
  readonly id: string;
  readonly name: string;
  readonly icon: (typeof catalogue.sites)[number]["icon"];
  /** What it is, in one line, for someone who has never heard of it. */
  readonly blurb: string;
  /**
   * The games it holds, named the way a player would name them.
   *
   * REQUIRED, and enforced by brand.test.ts. This site lists sites rather than
   * games, and nothing in the word "Taash" tells a reader that Call Break is
   * behind it. This is the line that answers "what do I actually get", so a
   * tile without one is asking to be clicked on trust, which is the one thing
   * this site does not do. A site holding a single game names that game.
   */
  readonly holds: string;
  /**
   * How many can sit down, phrased the way a player would ask it. It is the
   * first question anybody has about a game played with friends, and a card
   * that answers it saves a click on a game the reader cannot fill a table for.
   */
  readonly players: string;
  readonly status: GameStatus;
  /** Null while a game is still being built, so a link is never dead. */
  readonly url: string | null;
  /**
   * Null when the game has nothing real to show yet. A tile then falls back to
   * type, which is honest, rather than to a placeholder, which is not.
   */
  readonly art: GameArt | null;
  /**
   * What the tile shows when `art` is null.
   *
   * `cards` deals a real hand with the real dealing function, which is a true
   * picture of a card game and a false one of anything else. It was the only
   * fallback here while the card room was the only game without a photograph,
   * and the day a drawing game and a word game arrived it started showing them
   * both holding a hand of cards they do not have. `type` is the neutral
   * answer: the game's name, set large, claiming nothing.
   */
  readonly fallback: "cards" | "type";
}

const GAME_PRESENTATION: readonly Omit<Game, "name" | "url" | "icon">[] = [
  {
    id: "chaupal",
    blurb:
      "Board games rolled from dice you can check. Start a room, send the link, no signup and no install.",
    holds: "Ludo, Snakes and Ladders",
    players: "2 to 4 players",
    status: "live",
    // On Cloudflare, for the reason `resolveUrl` gives above.
    art: {
      src: "/art/chaupal-snakes-and-ladders.webp",
      width: 1100,
      height: 1220,
      alt: "A Snakes and Ladders board mid-game in Circuit, with two pieces waiting on the start row.",
    },
    fallback: "type",
  },
  {
    // Renamed from "judgement" when the card room stopped being one game. The
    // room is called Taash, which is simply what a deck of cards is called
    // across northern India, and Judgement is now the first of eight games in
    // it rather than the whole of it.
    id: "taash",
    blurb:
      "Six card games for a table and three games of patience for one, dealt from a shuffle nobody at the table chose. Judgement, where you bid exactly how many you will win, is the one it started as.",
    holds: "",
    players: "1 to 10 players",
    status: "live",
    // Its own deployment now, and on Cloudflare rather than Vercel. The link
    // goes to the room rather than to any one game in it: every game inside is
    // one press from here, and a studio that deep-linked to one of eight would
    // be picking a favourite.
    // Judgement's tile deals a real hand instead of showing a photograph. A
    // card game's table is its players' hands, and those are private, so there
    // is nothing to photograph that would not be a staged lie.
    art: null,
    fallback: "cards",
  },
  {
    id: "draw",
    blurb:
      "One person draws it and everybody else races to name it. Or the whole table draws the same word at once and then votes on whose is best.",
    holds: "Charade, Everyone Draws",
    players: "2 to 12 players",
    status: "live",
    // Every site in the studio is a Cloudflare Worker now, built on a laptop and
    // uploaded, which spends no build minutes anywhere. Draw and Lattice sat on
    // Netlify for a few weeks in between, and those copies are still answering:
    // they are stale and are to be retired, not linked.
    art: {
      src: "/art/charade-drawing.webp", width: 1200, height: 1059, alt: "Charade",
    },
    fallback: "type",
  },
  {
    id: "lattice",
    blurb:
      "Words that cross, on a board that says what counts. Play it at a table with friends, or alone against the board.",
    holds: "Lattice, solo or at a table",
    players: "1 to 4 players",
    status: "live",
    // A capture of the real solo board on the live deployment, taken from
    // /solo after dealing: the premium squares this game is actually printed
    // with, and a real opening rack.
    art: {
      src: "/art/lattice-solo-board.webp",
      width: 1500,
      height: 1600,
      alt: "A Lattice board at the start of a solo game, its premium squares laid out and a rack of seven letters below it.",
    },
    fallback: "type",
  },
  {
    id: "teenpatti",
    blurb: "No real money",
    holds: "",
    // Casino's house games are solo; Teen Patti keeps the table's upper limit.
    players: `${catalogue.sites.find((site) => site.id === "teenpatti")?.games?.some(
      (game) => game.id !== "teenpatti",
    ) ? 1 : 2} to 6 players`,
    status: "live",
    art: { src: "/art/casino-roulette.webp", width: 900, height: 780, alt: "Casino" },
    fallback: "type",
  },
] as const;

/** Names, destinations and Deal's game order come from the game release. */
export const GAMES: readonly Game[] = GAME_PRESENTATION.map((presentation) => {
  const published = catalogue.sites.find((site) => site.id === presentation.id);
  if (!published) throw new Error(`Missing game catalogue entry: ${presentation.id}`);
  return { ...presentation, name: published.name, icon: published.icon,
    url: presentation.status === "live" ? published.url : null,
    holds: published.games?.map((game) => game.name).join(", ") ?? presentation.holds };
});

/**
 * The studio's own key art, for the top of the home page.
 *
 * It is the Ludo board from a real game on Circuit, which is the most
 * photographable thing the studio has made.
 */
export const HERO_ART: GameArt = {
  src: "/art/chaupal-ludo.webp",
  width: 1600,
  height: 915,
  alt: "A Ludo board in Circuit, seen in perspective, with four red and four green pieces in their yards.",
};

/**
 * The live games, for anywhere that offers a way to go and play rather than a
 * description of the catalogue. Derived, so a game going live is one edit.
 */
export const PLAYABLE = GAMES.filter(
  (game): game is Game & { url: string } => game.url !== null,
);

/**
 * The path on this site that sends somebody to a game, one per live game.
 *
 * It exists because of how an installed app is allowed to behave. A web
 * manifest may only list shortcuts that fall inside its own scope, and every
 * game is a different origin, so "Charade" cannot be a shortcut on the studio's
 * icon by pointing at Charade. It can point here, and here redirects.
 *
 * Which makes the studio worth installing on its own: one icon on a home
 * screen, and a long press on it lists the four games. `next.config.ts` builds
 * the redirects from this and `app/manifest.ts` builds the shortcuts from it,
 * so a game arriving or moving is still one edit in `GAMES` above.
 */
export function playPath(game: Game): string {
  return `/play/${game.name.toLowerCase().replace(/\s+/g, "-")}`;
}

// Counted rather than written, because "Two games" hardcoded above a list of
// three is the kind of stale copy nobody thinks to check.
const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"] as const;

export const GAME_COUNT_WORD: string = COUNT_WORDS[GAMES.length] ?? String(GAMES.length);
