import { MAKER, STUDIO_NAME, studio } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="shell colophon">
      <p>
        {STUDIO_NAME}. Made by {MAKER.name} in {MAKER.where}.
      </p>
      <p>
        <a href={studio.github} rel="noreferrer">
          Source on GitHub
        </a>
      </p>
    </footer>
  );
}
