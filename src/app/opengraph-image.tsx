import { ImageResponse } from "next/og";
import { STUDIO_NAME, STUDIO_TAGLINE } from "@/lib/brand";

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
          <svg width="52" height="52" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#3b3bd0" />
            <circle cx="9" cy="23" r="3" fill="#ffffff" />
            <circle cx="16" cy="16" r="3" fill="#ffffff" />
            <circle cx="23" cy="9" r="3" fill="#ffffff" />
          </svg>
          <div style={{ fontSize: 34, letterSpacing: "-0.01em" }}>{STUDIO_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 78, lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: 950 }}>
            Every roll is decided before we know who it helps.
          </div>
          <div style={{ fontSize: 30, color: "#62627d", maxWidth: 820 }}>
            Board and card games whose dice you can check afterwards, instead of trusting.
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
          <div>Chaupal</div>
          <div>Judgement</div>
          <div>Free, no account, no install</div>
        </div>
      </div>
    ),
    size,
  );
}
