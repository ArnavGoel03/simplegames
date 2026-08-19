// The legal surface, authored once.
//
// Every legal page reads its title, its effective date and the address people
// write to from this file. The index at /legal and the sitemap are both
// generated from LEGAL_DOCS, so a document cannot exist without being listed,
// and cannot be listed without existing.

import { STUDIO_NAME } from "./brand";

/**
 * Where legal notices, privacy requests and infringement claims go.
 *
 * PENDING: this mailbox has to be created before the pages go live to a real
 * audience. A published address that bounces is worse than no address, because
 * it converts a person trying to reach you into a person with a complaint and
 * evidence that you ignored them.
 */
export const LEGAL_EMAIL = "glasstablegames.studio@gmail.com";

/**
 * The law these documents are read under, and the courts that would hear a
 * dispute about them.
 *
 * Deliberately null. Naming a forum you have not chosen is worse than naming
 * none, because a court asked to enforce a clause the author picked at random
 * tends to notice. Set this to a real jurisdiction before any money, any
 * account, or any user outside a circle of friends. The Terms page renders an
 * honest paragraph while it stays null and a normal governing-law clause the
 * moment it does not.
 */
export const JURISDICTION: string | null = null;

/**
 * The date this set of documents took effect.
 *
 * One date for the whole set, because they were written together and reading
 * them against each other is the only way they make sense. When a single
 * document changes materially, give it its own `updated` value below rather
 * than moving this.
 */
export const EFFECTIVE = "11 August 2026";

export interface LegalDoc {
  readonly slug: string;
  readonly title: string;
  /** One line, shown on the index. What a reader gets by opening it. */
  readonly summary: string;
  /** Set only when this document has changed since EFFECTIVE. */
  readonly updated?: string;
}

export const LEGAL_DOCS = [
  {
    slug: "terms",
    title: "Terms of use",
    summary:
      "What you may do with the games, what is promised, and what is not. Free to play, nothing to buy, no money involved.",
  },
  {
    slug: "privacy",
    title: "Privacy",
    summary:
      "What is collected about you, which is nothing, and what the hosting provider sees regardless.",
  },
  {
    slug: "cookies",
    title: "Cookies",
    summary: "This site sets none, and does not load anything that could set one on its behalf.",
  },
  {
    slug: "rules-of-play",
    title: "Rules of play",
    summary:
      "How to behave in a room with other people, and the short list of things that will get a game shut down.",
  },
  {
    slug: "content",
    title: "Content and age",
    summary:
      "What is in the games, who they are suitable for, and why they carry no ESRB or PEGI rating.",
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    summary:
      "What has been built for, what has not been tested, and where to write when something is unusable.",
  },
  {
    slug: "intellectual-property",
    title: "Copyright and trademarks",
    summary:
      "Who owns the code and the names, which games are nobody's property, and how to report an infringement.",
  },
] as const satisfies readonly LegalDoc[];

/**
 * The slugs as a union rather than plain strings.
 *
 * This is what makes the document map in src/app/legal/[slug]/documents.ts a
 * compile-time guarantee: a document listed here with no prose written for it
 * fails the build, instead of shipping a legal page that 404s from a link in
 * the footer of every page on the site.
 */
export type LegalSlug = (typeof LEGAL_DOCS)[number]["slug"];

export const LEGAL_INDEX_PATH = "/legal";

export function legalPath(slug: string): string {
  return `${LEGAL_INDEX_PATH}/${slug}`;
}

/** Every legal URL, for the sitemap. The index plus one per document. */
export const LEGAL_PATHS: readonly string[] = [
  LEGAL_INDEX_PATH,
  ...LEGAL_DOCS.map((doc) => legalPath(doc.slug)),
];

/**
 * Returns the widened LegalDoc rather than the frozen literal type, so callers
 * can read the optional `updated` field. `as const` narrows each entry to
 * exactly the keys it was written with, which is what gives us LegalSlug, but
 * it also makes an absent optional field unreachable rather than undefined.
 */
export function findLegalDoc(slug: string): LegalDoc | undefined {
  return (LEGAL_DOCS as readonly LegalDoc[]).find((doc) => doc.slug === slug);
}

/** The same list, widened, for callers that render optional fields. */
export const DOCS: readonly LegalDoc[] = LEGAL_DOCS;

/**
 * The sentence that appears above every document. Kept here so that all seven
 * agree about who "we" is without seven copies of the studio name.
 */
export const LEGAL_PARTY = STUDIO_NAME;
