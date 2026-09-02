import type { MetadataRoute } from "next";
import { PLAYABLE, studio } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    // The games' sitemaps are offered here as well as this site's own. A
    // crawler reads the apex before it has any reason to guess at a subdomain,
    // and this is the one file it is certain to ask for, so naming them here is
    // the cheapest way a game's pages get found at all.
    //
    // Pointing at another host from robots.txt is only honoured when the same
    // owner is proved for both, which is the case: verification sits on the
    // apex as a DNS record, and that makes one property covering every
    // subdomain under it. Derived from the registry, so a game that moves or
    // arrives is still one edit in `GAMES`.
    sitemap: [
      new URL("/sitemap.xml", studio.url).toString(),
      ...PLAYABLE.map((game) => new URL("/sitemap.xml", game.url).toString()),
    ],
  };
}
