import { STUDIO_MARK } from "@/lib/studio-mark";
import palette from "@/lib/palette.json";
import { ImageResponse } from "next/og";
import { GAMES, STUDIO_NAME, STUDIO_TAGLINE } from "@/lib/brand";

// The card people see when the link is pasted into a chat. A blank one reads
// as an unfinished site, which is the opposite of the argument this site makes.
//
// Deliberately typographic and flat: no photograph to load, no gradient, and
// the same palette as the page itself, so arriving from the card does
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
          background: palette.dark.paper,
          color: palette.dark.ink,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="52" height="52" viewBox={STUDIO_MARK.viewBox} fill="none"
            stroke={palette.dark.ink} strokeWidth={STUDIO_MARK.stroke} strokeLinecap="round" strokeLinejoin="round">
            {STUDIO_MARK.paths.map((path) => <path key={path} d={path} />)}
          </svg>
          <div style={{ fontSize: 34, letterSpacing: "-0.01em" }}>{STUDIO_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 78, lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: 950 }}>
            Every roll and every deal is settled before we know who it helps.
          </div>
          <div style={{ fontSize: 30, color: palette.dark.muted, maxWidth: 820 }}>
            Board and card games whose dice and shuffles you can check afterwards, instead of
            trusting.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: palette.dark.muted,
            borderTop: `1px solid ${palette.dark.rule}`,
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
