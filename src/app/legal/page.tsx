import type { Metadata } from "next";
import Link from "next/link";
import { STUDIO_NAME } from "@/lib/brand";
import { DOCS, EFFECTIVE, LEGAL_EMAIL, legalPath } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Legal",
  description: `The terms, privacy, content and accessibility documents for ${STUDIO_NAME}, written to be read rather than clicked past.`,
  alternates: { canonical: "/legal" },
};

export default function LegalIndexPage() {
  return (
    <section className="shell shell--wide band band--flush">
      <div className="prose">
        <p className="eyebrow">Legal</p>
        <h1>Seven documents, written to be read.</h1>
        <p>
          Most legal pages are written so that nobody finishes them. These are written so that
          somebody might, because almost everything in them is good news and the parts that are not
          are worth knowing.
        </p>
        <p>
          The short version: the games are free, no money is involved, nothing is collected about
          you, and no cookie is set. Everything below is that, in the detail it deserves.
        </p>
      </div>

      <ul className="docs">
        {DOCS.map((doc) => (
          <li key={doc.slug} className="docs__item">
            <Link href={legalPath(doc.slug)} className="docs__link">
              <span className="docs__title">{doc.title}</span>
              <span className="docs__summary">{doc.summary}</span>
              <span className="docs__meta">
                {doc.updated ? `Updated ${doc.updated}` : `Effective ${EFFECTIVE}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="prose prose--gap">
        <h2>Reaching a person</h2>
        <p>
          Every document on this page gives the same address, because there is one person behind
          all of them: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. Legal notices, privacy
          requests, accessibility problems and copyright claims all arrive in the same place and are
          answered by the person who can act on them.
        </p>
      </div>
    </section>
  );
}
