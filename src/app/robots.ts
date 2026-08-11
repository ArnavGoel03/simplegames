import type { MetadataRoute } from "next";
import { studio } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", studio.url).toString(),
  };
}
