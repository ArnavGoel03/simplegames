import Link from "next/link";
import { MAKER, PLAYABLE, STUDIO_NAME, studio } from "@/lib/brand";
import { LEGAL_DOCS, LEGAL_INDEX_PATH, legalPath } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="shell shell--wide colophon">
      {/* The games themselves, because every page other than the home page
          argues for them and then offers no way to go and play one. */}
      <nav className="colophon__games" aria-label="Games">
        {PLAYABLE.map((game) => (
          <a key={game.id} href={game.url}>
            Play {game.name}
          </a>
        ))}
      </nav>
      <nav className="colophon__legal" aria-label="Legal">
        <Link href={LEGAL_INDEX_PATH}>Legal</Link>
        {LEGAL_DOCS.map((doc) => (
          <Link key={doc.slug} href={legalPath(doc.slug)}>
            {doc.title}
          </Link>
        ))}
      </nav>
      <div className="colophon__base">
        <p>
          {STUDIO_NAME}. Made by {MAKER.name}.
        </p>
        <p>
          <a href={studio.github} rel="noreferrer">
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
