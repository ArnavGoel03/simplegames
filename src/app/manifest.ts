import type { MetadataRoute } from "next";
import { studio, STUDIO_NAME, STUDIO_TAGLINE } from "@/lib/brand";

// What the studio is, to an operating system.
//
// Without this file the site is a page. With it, it is something a person can
// keep: installed to a home screen on Android and iOS, to the dock on macOS,
// to the Start menu on Windows, and opened from a launcher on Linux, in a
// window with no browser chrome. The four game sites have had one for a while
// and the studio site did not, so the one page that introduces them was the
// only one you could not keep.
//
// Every string here is derived rather than written out, for the same reason
// they are everywhere else in this repository: this file and the header would
// otherwise be two places that know the studio's name, and they would disagree
// the day it changed. It has changed twice.

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${STUDIO_NAME}, ${STUDIO_TAGLINE.toLowerCase()}`,
    short_name: STUDIO_NAME,
    description: studio.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The page's own ground, so the window the OS opens does not flash a
    // colour the site never uses. Light rather than dark: an installed app
    // takes one background and this site's default is paper.
    background_color: studio.themeColor.light,
    theme_color: studio.themeColor.light,
    orientation: "any",
    categories: ["games", "entertainment"],
    lang: studio.lang,
    icons: [
      // Order matters less than purpose. `any` is the icon as drawn; `maskable`
      // is the same mark on a full bleed ground, because Android crops to a
      // circle or a squircle and would otherwise shave the corners off a
      // rounded square.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
