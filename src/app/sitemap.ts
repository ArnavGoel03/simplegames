import type { MetadataRoute } from "next";
import { ROUTES, studio } from "@/lib/brand";
import { LEGAL_PATHS } from "@/lib/legal";

// Reads the same two lists the header and the footer do, so a page cannot
// exist in navigation and be missing from the sitemap. Legal paths are derived
// from LEGAL_DOCS, which means adding a document adds its sitemap entry.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...ROUTES.map((route) => route.path), ...LEGAL_PATHS];

  return paths.map((path) => ({
    url: new URL(path, studio.url).toString(),
    changeFrequency: "monthly",
    // Legal pages are real and indexable, but they are not what somebody
    // arriving from a search should be handed first.
    priority: path === "/" ? 1 : path.startsWith("/legal") ? 0.3 : 0.7,
  }));
}
