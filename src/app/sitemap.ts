import type { MetadataRoute } from "next";
import { ROUTES, studio } from "@/lib/brand";

// Reads the same route list the header does, so a page cannot exist in
// navigation and be missing from the sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: new URL(route.path, studio.url).toString(),
    changeFrequency: "monthly",
    priority: route.path === "/" ? 1 : 0.7,
  }));
}
