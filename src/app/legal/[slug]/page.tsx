import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_BODIES } from "@/components/legal";
import {
  EFFECTIVE,
  LEGAL_DOCS,
  LEGAL_INDEX_PATH,
  findLegalDoc,
  legalPath,
  type LegalSlug,
} from "@/lib/legal";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return LEGAL_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: legalPath(doc.slug) },
  };
}

export default async function LegalDocPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) notFound();

  const Body = LEGAL_BODIES[doc.slug as LegalSlug];

  return (
    <article className="shell shell--wide band band--flush">
      <div className="prose">
        <p className="eyebrow">
          <Link href={LEGAL_INDEX_PATH}>Legal</Link>
        </p>
        <h1>{doc.title}</h1>
        <p className="docdate">
          {doc.updated ? (
            <>
              Effective {EFFECTIVE}. Last updated {doc.updated}.
            </>
          ) : (
            <>Effective {EFFECTIVE}. Not changed since.</>
          )}
        </p>
      </div>

      <div className="prose prose--doc">
        <Body />
      </div>

      <nav className="docnav" aria-label="Other legal documents">
        {/* No possessive: "Glass Table Games's" is what a name ending in s does to one. */}
        <p className="docnav__label">The rest of the legal pages</p>
        <ul>
          {LEGAL_DOCS.filter((other) => other.slug !== doc.slug).map((other) => (
            <li key={other.slug}>
              <Link href={legalPath(other.slug)}>{other.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
