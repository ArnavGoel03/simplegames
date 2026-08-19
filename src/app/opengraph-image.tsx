import { ImageResponse } from "next/og";
import { GAMES, STUDIO_NAME, STUDIO_TAGLINE } from "@/lib/brand";

// The card people see when the link is pasted into a chat. A blank one reads
// as an unfinished site, which is the opposite of the argument this site makes.
//
// Deliberately typographic and flat: no photograph to load, no gradient, and
// the same indigo and paper as the page itself, so arriving from the card does
// not feel like arriving somewhere else.

export const alt = `${STUDIO_NAME}, ${STUDIO_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f1f1f5",
          color: "#171733",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* The same mark as src/app/icon.svg, at card size. Written out
              rather than imported because Satori renders this to a PNG on its
              own and cannot read an external file or a custom property. */}
          <svg width="52" height="52" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#3b3bd0" />
            <rect
              x="6.5"
              y="6.5"
              width="19"
              height="19"
              rx="4"
              fill="#ffffff"
              fillOpacity="0.18"
              stroke="#ffffff"
              strokeOpacity="0.6"
              strokeWidth="2"
            />
            <circle cx="12.6" cy="19.4" r="2.9" fill="#ffffff" />
            <circle cx="19.4" cy="12.6" r="2.9" fill="#ffffff" />
          </svg>
          <div style={{ fontSize: 34, letterSpacing: "-0.01em" }}>{STUDIO_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 78, lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: 950 }}>
            Every roll and every deal is settled before we know who it helps.
          </div>
          <div style={{ fontSize: 30, color: "#62627d", maxWidth: 820 }}>
            Board and card games whose dice and shuffles you can check afterwards, instead of
            trusting.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#62627d",
            borderTop: "1px solid #d6d6e2",
            paddingTop: 28,
          }}
        >
          {/* Named from the registry rather than by hand, because a card that
              still lists a game the studio renamed is the kind of stale copy
              nobody thinks to check. */}
          <div>{GAMES.map((game) => game.name).join("  ·  ")}</div>
          <div>Free, no account, no install</div>
        </div>
      </div>
    ),
    size,
  );
}
