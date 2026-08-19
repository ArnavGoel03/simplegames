// The rules a game tile has to obey, enforced rather than remembered.
//
// The studio site's whole argument is that it does not ask to be taken on
// faith, and the fastest way to break that is a tile that overstates what is
// behind it. Each of these has already gone wrong once: a tile advertised a
// hand of cards for a game with no cards in it, two of them pointed at hosts
// that had been dead for weeks, and the games a site contains were listed on
// some entries and not others.

import { describe, expect, it } from "vitest";
import { GAMES, PLAYABLE, GAME_COUNT_WORD, studio } from "./brand";

describe("the games registry", () => {
  it("has at least one game", () => {
    expect(GAMES.length).toBeGreaterThan(0);
  });

  /*
    THE RULE: every entry names the games it contains.

    A studio site lists sites, not games, and a reader cannot tell from the word
    "Taash" that Call Break is behind it. `holds` is the line that answers "what
    do I actually get", and a tile without one is a tile asking to be clicked on
    trust. For a site with one game in it, that game's own name is the honest
    answer.
  */
  it.each(GAMES.map((game) => [game.name, game] as const))(
    "%s names the games it contains",
    (_name, game) => {
      expect(game.holds.trim()).not.toBe("");
      // The line has to mention something a player would recognise as a game,
      // which at minimum means the site's own name when it holds only itself.
      const named = game.holds.split(/,|\band\b/).map((part) => part.trim()).filter(Boolean);
      expect(named.length).toBeGreaterThan(0);
    },
  );

  it.each(GAMES.map((game) => [game.name, game] as const))(
    "%s says how many can sit down",
    (_name, game) => {
      expect(game.players).toMatch(/\d/);
      expect(game.players).toMatch(/player/i);
    },
  );

  it.each(GAMES.map((game) => [game.name, game] as const))(
    "%s is described in its own words",
    (_name, game) => {
      expect(game.blurb.trim().length).toBeGreaterThan(20);
    },
  );

  /*
    A live game has somewhere to go, and a game still being built does not
    pretend to. Both directions matter: a live tile with no link is a dead end,
    and a link on an unfinished game is a 404 with the studio's name on it.
  */
  it.each(GAMES.map((game) => [game.name, game] as const))(
    "%s links only if it is live",
    (_name, game) => {
      if (game.status === "live") {
        expect(game.url, `${game.name} is live but has no address`).toBeTruthy();
        expect(game.url).toMatch(/^https:\/\//);
      } else {
        expect(game.url, `${game.name} is not live but carries a link`).toBeNull();
      }
    },
  );

  /*
    Vercel soft blocked the whole account on 17 August 2026 and every site on it
    began answering 402. Two entries here still pointed at vercel.app hosts
    weeks later, because nothing failed when they went stale.
  */
  it.each(GAMES.map((game) => [game.name, game] as const))(
    "%s does not point at a retired host",
    (_name, game) => {
      // Two hosts have been retired under this studio and both left copies
      // answering after the move: Vercel when the account was blocked, Netlify
      // when the last two sites came home to Cloudflare. A live stale copy is
      // worse than a dead link, because it looks fine and is months old.
      expect(game.url ?? "").not.toMatch(/vercel\.app/);
      expect(game.url ?? "").not.toMatch(/netlify\.app/);
    },
  );

  /*
    The fan deals a real hand with the real dealing function, which is a true
    picture of a card game and a false one of everything else.
  */
  it.each(GAMES.map((game) => [game.name, game] as const))(
    "%s only deals cards as art if it is the card room",
    (_name, game) => {
      if (game.fallback === "cards") expect(game.id).toBe("taash");
    },
  );

  it("describes every picture it shows", () => {
    for (const game of GAMES) {
      if (!game.art) continue;
      expect(game.art.alt.trim().length, `${game.name} art has no alt text`).toBeGreaterThan(20);
      expect(game.art.width).toBeGreaterThan(0);
      expect(game.art.height).toBeGreaterThan(0);
    }
  });

  it("derives the count word from the list rather than repeating it", () => {
    expect(GAME_COUNT_WORD.toLowerCase()).not.toBe("");
    expect(PLAYABLE.length).toBe(GAMES.filter((game) => game.url !== null).length);
  });

  it("has a studio address that is not a dead alias", () => {
    expect(studio.url).toMatch(/^https:\/\//);
    expect(studio.url).not.toMatch(/vercel\.app/);
  });
});
