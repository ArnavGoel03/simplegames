import Link from "next/link";
import { NAV, STUDIO_NAME } from "@/lib/brand";

export function SiteHeader() {
  return (
    <header className="shell masthead">
      <Link href="/" className="wordmark">
        {STUDIO_NAME}
      </Link>
      <nav aria-label="Primary">
        {NAV.map((route) => (
          <Link key={route.path} href={route.path}>
            {route.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
