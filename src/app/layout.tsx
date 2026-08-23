import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SiteHeader } from "@/components/SiteHeader";
import { STUDIO_NAME, STUDIO_TAGLINE, studio } from "@/lib/brand";
import { studioNode } from "@/lib/structured-data";
import "./globals.css";

// Fraunces carries the personality. SOFT rounds the terminals and WONK swaps
// in the slanted single-storey forms, which together stop it reading as a
// stock high-contrast serif; the axes are set once in globals.css.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
  variable: "--font-fraunces",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-sans",
});

// Hashes and dice are data, and data is set in a face built for reading it
// back character by character.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(studio.url),
  title: {
    default: `${STUDIO_NAME}, ${STUDIO_TAGLINE.toLowerCase()}`,
    template: `%s, ${STUDIO_NAME}`,
  },
  description: studio.description,
  applicationName: STUDIO_NAME,
  openGraph: {
    type: "website",
    siteName: STUDIO_NAME,
    locale: studio.locale,
    url: studio.url,
    title: `${STUDIO_NAME}, ${STUDIO_TAGLINE.toLowerCase()}`,
    description: studio.description,
  },
  // The card this site actually ships is 1200 by 630, which is what
  // `summary_large_image` shows and what `summary` crops into a small square
  // beside the text. All four game sites use the large one; this one did not,
  // so the studio's own link was the worst looking of the five.
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  /*
    Every icon this site has, declared together.

    They are not interchangeable and each exists because one platform will not
    take the others. The SVG is what a current browser prefers and the only one
    that stays sharp at any size. The ICO is what Windows, older browsers and
    Google's favicon crawler still ask for at /favicon.ico, and this site
    answered 404 there for its whole life. The PNGs are what a manifest needs.
    And apple-touch-icon is what Safari uses for a bookmark, a Start Page tile
    and a home screen: with none present it draws a grey square with the first
    letter of the title in it, which is why a bookmark to this studio once said
    "G".
  */
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // What iOS reads when the site is kept on a home screen: it opens without
    // browser chrome and the status bar takes the page's own ground.
    capable: true,
    title: STUDIO_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: studio.themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: studio.themeColor.dark },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={studio.lang}
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        {/* Who publishes this, on every page rather than on the front page
            alone.

            Every game of this studio is on its own origin, so a crawler meets
            five websites, and five websites by the same author is not the same
            claim as one studio with four sites. What joins them is this node,
            declared with the same `@id` here and on all four games, so the
            organisation read on one is the organisation read on the others
            rather than a new one with a familiar name. It is also what every
            `publisher` on every page points at, and a reference to an id nothing
            defines says nothing at all. See src/lib/structured-data.ts. */}
        <JsonLd data={studioNode()} />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <ServiceWorker />
      </body>
    </html>
  );
}
