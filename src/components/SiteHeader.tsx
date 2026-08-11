import Link from "next/link";
import { GAMES_LINK, NAV, STUDIO_NAME } from "@/lib/brand";

// The games come first, because that is what a studio is for. The anchor is
// listed alongside the routes rather than hand-written here, so there is still
// exactly one place a nav label is spelled.
const LINKS = [GAMES_LINK, ...NAV];

export function SiteHeader() {
  return (
    <header className="shell shell--wide masthead">
      <Link href="/" className="wordmark">
        {STUDIO_NAME}
      </Link>
      <nav aria-label="Primary">
        {LINKS.map((link) => (
          <Link key={link.path} href={link.path}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
