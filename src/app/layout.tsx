import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { STUDIO_NAME, STUDIO_TAGLINE, studio } from "@/lib/brand";
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
  twitter: { card: "summary" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: studio.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={studio.lang}
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
