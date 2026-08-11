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
  // The browser chrome above the page, so it has to be the page's own ground
  // colour: --paper in globals.css. A neutral value here draws a grey band
  // across the top of the page on a phone.
  themeColor: "#f1f1f5",
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

export interface Game {
  readonly id: string;
  readonly name: string;
  /** What it is, in one line, for someone who has never heard of it. */
  readonly blurb: string;
  /** The games it holds, named the way a player would name them. */
  readonly holds: string;
  readonly status: GameStatus;
  /** Null while a game is still being built, so a link is never dead. */
  readonly url: string | null;
}

export const GAMES: readonly Game[] = [
  {
    id: "chaupal",
    name: "Chaupal",
    blurb:
      "Board games rolled from dice you can check. Start a room, send the link, no signup and no install.",
    holds: "Ludo, Snakes and Ladders",
    status: "live",
    url: "https://chaupal-games.vercel.app",
  },
  {
    id: "judgement",
    name: "Judgement",
    blurb:
      "The trick-taking game where you bid exactly how many you will win, and overshooting costs you as much as falling short.",
    holds: "Judgement, also called Kachuful",
    status: "building",
    url: null,
  },
] as const;
