// The studio, authored once.
//
// Anything that names the studio, addresses it, or describes it to a machine
// reads from here: metadata, structured data, the sitemap, share cards, the
// header, the footer. A second copy of any of these is a bug, because copies
// drift silently and the wrong one is usually the one a crawler read.

/**
 * The studio's stable identifier.
 *
 * FROZEN. This is not a display string. It is the issuer and audience stamped
 * into every session token across every product the studio ships, so changing
 * it invalidates every live session and signs every player out. It was chosen
 * while the number of accounts in existence was zero. Leave it alone.
 */
export const STUDIO_ID = "simplegames";

export const STUDIO_NAME = "Simple Games";

/**
 * What the studio does, in the fewest words that are still true. Not a slogan:
 * it appears as the page title suffix and in search results, where a slogan
 * reads as noise and a description reads as an answer.
 */
export const STUDIO_TAGLINE = "Games you can check";

export const STUDIO_DESCRIPTION =
  "Simple Games builds board and card games for playing with friends. Every roll is committed to before it happens and published afterwards, so nobody has to take our word for it.";

function resolveUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  // The production alias Vercel actually assigned. simplegames.vercel.app was
  // already taken, and a canonical tag pointing at somebody else's site is
  // worse than an ugly one pointing at ours. Set NEXT_PUBLIC_SITE_URL when a
  // real domain is registered.
  return "https://simplegames-chi.vercel.app";
}

export const studio = {
  id: STUDIO_ID,
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
    light: "#f1f1f5",
    dark: "#0f0f18",
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
 * Every one of these is a screenshot of the real thing, taken from the live
 * deployment and cropped, never an illustration of a game that does not look
 * like that. A studio page that shows art the game does not match is making a
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
  /** What it is, in one line, for someone who has never heard of it. */
  readonly blurb: string;
  /** The games it holds, named the way a player would name them. */
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
}

export const GAMES: readonly Game[] = [
  {
    id: "chaupal",
    name: "Chaupal",
    blurb:
      "Board games rolled from dice you can check. Start a room, send the link, no signup and no install.",
    holds: "Ludo, Snakes and Ladders",
    players: "2 to 4 players",
    status: "live",
    url: "https://chaupal-games.vercel.app",
    art: {
      src: "/art/chaupal-snakes-and-ladders.webp",
      width: 1100,
      height: 1220,
      alt: "A Snakes and Ladders board mid-game in Chaupal, with two pieces waiting on the start row.",
    },
  },
  {
    id: "judgement",
    name: "Judgement",
    blurb:
      "The trick-taking game where you bid exactly how many you will win, and overshooting costs you as much as falling short.",
    holds: "Judgement, also called Kachuful",
    players: "3 or 4 players",
    status: "live",
    // Judgement has its own page and its own table, both served from Chaupal's
    // deployment until it has a domain of its own. The link goes to the page
    // rather than the studio's idea of where it ought to live.
    url: "https://chaupal-games.vercel.app/judgement",
    // Judgement's tile deals a real hand instead of showing a photograph. A
    // card game's table is its players' hands, and those are private, so there
    // is nothing to photograph that would not be a staged lie.
    art: null,
  },
] as const;

/**
 * The studio's own key art, for the top of the home page.
 *
 * It is the Ludo board from a real game on Chaupal, which is the most
 * photographable thing the studio has made.
 */
export const HERO_ART: GameArt = {
  src: "/art/chaupal-ludo.webp",
  width: 1600,
  height: 915,
  alt: "A Ludo board in Chaupal, seen in perspective, with four red and four green pieces in their yards.",
};

/**
 * The live games, for anywhere that offers a way to go and play rather than a
 * description of the catalogue. Derived, so a game going live is one edit.
 */
export const PLAYABLE = GAMES.filter(
  (game): game is Game & { url: string } => game.url !== null,
);

// Counted rather than written, because "Two games" hardcoded above a list of
// three is the kind of stale copy nobody thinks to check.
const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"] as const;

export const GAME_COUNT_WORD: string = COUNT_WORDS[GAMES.length] ?? String(GAMES.length);
