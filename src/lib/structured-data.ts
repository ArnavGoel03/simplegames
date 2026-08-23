// The studio, described to a crawler.
//
// This site had none of this, which is the one place it could least afford to.
// Every game is on its own origin, so a search engine meets five websites, and
// five websites by the same author is not the same claim as one studio with
// four sites: the second is what gets a studio recognised as a thing rather
// than a coincidence of wording. The node below is what makes that claim, and
// the games repository declares the same node with the same `@id` on all four
// of its sites, so a crawler reading any of the five reads one organisation
// rather than five with a familiar name.
//
// The `@id` is the contract. It is a fragment on this site's own origin,
// because this is the address that outlives any one game, and it has to match
// `STUDIO_ID` in `packages/studio/src/seo/schema.ts` in the games repository to
// the byte. Both are built the same way, from the studio's own URL, so the two
// agree as long as neither site is told it lives somewhere else.
//
// Everything here is built from `brand.ts` and `legal.ts`, which is what makes
// it safe to ship: a description a crawler can catch out is worse than no
// structured data at all, and the only way to be sure it cannot drift is for it
// to have no second copy of anything.

import { GAMES, MAKER, STUDIO_NAME, studio } from "./brand";

/** The one identifier every site of this studio agrees on. */
export const STUDIO_ID = `${studio.url}/#studio`;

const WEBSITE_ID = `${studio.url}/#website`;

function absolute(path: string): string {
  return new URL(path, studio.url).toString();
}

/**
 * The studio itself.
 *
 * An `Organization` rather than a `Person`: the studio is what ships games, and
 * the person behind it is named as its founder rather than asserted as the same
 * entity. `sameAs` carries the source repository, which is a page that
 * identifies this studio, and deliberately not the four game sites: `sameAs`
 * means "another page about this same thing", and a game is not another page
 * about the studio, it is something the studio publishes. That relationship is
 * expressed the way schema.org expresses it, by each game site naming this node
 * as its publisher and by the catalogue below.
 */
export function organization(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": STUDIO_ID,
    name: STUDIO_NAME,
    url: studio.url,
    description: studio.description,
    logo: absolute("/icon-512.png"),
    founder: { "@type": "Person", name: MAKER.name },
    sameAs: [studio.github],
  };
}

/** The studio node as a block of its own, for a page to carry. */
export function studioNode(): Record<string, unknown> {
  return { "@context": "https://schema.org", ...organization() };
}

export function webSite(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: STUDIO_NAME,
    url: studio.url,
    description: studio.description,
    inLanguage: studio.lang,
    publisher: { "@id": STUDIO_ID },
  };
}

/**
 * The catalogue: what this studio publishes, and where each one is.
 *
 * The one page whose subject really is the list. Every field is read off
 * `GAMES`, including whether a game has an address yet, so a game still being
 * built is described without a link rather than linked to a page that does not
 * exist. A crawler that follows this list is the crawler that learns the four
 * game sites belong to this one.
 */
export function gameCatalogue(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: STUDIO_NAME,
    numberOfItems: GAMES.length,
    itemListElement: GAMES.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Game",
        name: game.name,
        description: game.blurb,
        publisher: { "@id": STUDIO_ID },
        ...(game.url === null ? {} : { url: game.url }),
      },
    })),
  };
}

/**
 * Where a page sits, for the trail a result carries under its title.
 *
 * The home page is always the first step and is written from the studio's own
 * URL, so a page that moves cannot leave a trail pointing at where it used to
 * be. The label of each step is the page's own, passed in by the page, because
 * the page is what knows what it is called.
 */
export function breadcrumbs(
  trail: readonly { readonly name: string; readonly path: string }[],
): Record<string, unknown> {
  const steps = [{ name: STUDIO_NAME, path: "/" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: absolute(step.path),
    })),
  };
}
