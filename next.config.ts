import type { NextConfig } from "next";

// Nothing here is dynamic: three routes, no database, no images from anywhere
// but this repository. Everything below is a header rather than a feature.
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
    The optimiser is off, and measurement is why.

    Every image here is already a hand-cropped webp committed to this
    repository, so there is nothing left for it to do: asking the deployed site
    for the same picture at `w=384` and at `w=3840` returned byte-identical
    62KB both times. What it did add was a dynamic route in front of a static
    file, so each picture cost a Worker invocation and missed the immutable
    edge caching that `/art/*.webp` gets for free as an asset.

    The visible symptom was the tile art arriving seconds late on a cold open,
    which on this page means a dark rectangle where a board should be.
  */
  images: { unoptimized: true },
  /*
    One address for this site, not two.

    www had to be attached to the Worker to reach it at all, so this is what
    happens when it does: a permanent redirect to the apex, carrying the path.
    Serving the same pages on both names would split the site in a crawler's
    index and make the canonical tag the only thing holding them together,
    which is a weaker guarantee than simply not having a second address.
  */
  async redirects() {
    // Two rules rather than one, because `:path*` matches zero segments and
    // then does not substitute: the bare host redirected to a URL with a
    // literal ":path*" in it. `:path+` requires at least one segment, so the
    // root is handled on its own and everything below it keeps its path.
    const host = [{ type: "host" as const, value: "www.glasstablegames.com" }];
    return [
      { source: "/", has: host, destination: "https://glasstablegames.com/", permanent: true },
      {
        source: "/:path+",
        has: host,
        destination: "https://glasstablegames.com/:path+",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No third-party script, style, font or connection is loaded by this
          // site, so everything below is locked to this origin.
          //
          // script-src allows inline because Next ships the route payload as
          // inline script tags, and the alternative is a nonce, which needs
          // middleware, which makes every route dynamic and gives up the
          // static prerender that is the whole reason this site is fast. The
          // trade is acceptable here specifically because the site renders no
          // user input at all: three static pages, no forms, no query
          // parameters read, no content from anywhere but this repository. The
          // day any of that stops being true, this needs revisiting.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self'",
              "form-action 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
