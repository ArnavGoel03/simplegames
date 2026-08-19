// The studio's mark: a glass table, seen from above.
//
// It is the argument rather than a decoration. Two pieces sit on a pane, and
// their shadows are drawn *underneath* it rather than beside them, so the
// surface reads as something you can see through rather than something you
// cannot. That is the whole claim the studio makes, in four shapes.
//
// Inline SVG rather than an <img>, for two reasons that both matter here: it
// inherits the page's colours through the tokens in globals.css, so it is
// correct in both schemes without a second file, and it costs no request on a
// site whose entire point is that it loads instantly.
//
// The animation lives in globals.css beside every other rule. It runs once, on
// first paint, and it is skipped entirely for a reader who has asked for less
// motion, who then simply gets the cleared state.

export function StudioMark() {
  return (
    <svg
      className="mark"
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {/* Under the glass: the shadows, offset the way a light above a table
          would throw them, and drawn first so the pane covers them. */}
      <g className="mark__under">
        <circle cx="13.4" cy="20.4" r="3.1" />
        <circle cx="20.4" cy="13.4" r="3.1" />
      </g>

      {/* The pane itself. Translucent, so what is beneath stays visible. */}
      <rect className="mark__pane" x="3" y="3" width="26" height="26" rx="6" />

      {/* On the glass: the pieces, solid, sitting above their own shadows. */}
      <g className="mark__pieces">
        <circle cx="12.5" cy="19.5" r="3.1" />
        <circle cx="19.5" cy="12.5" r="3.1" />
      </g>

      {/* The frost, which clears. Last in the document so it covers the rest
          until it has gone. */}
      <rect className="mark__frost" x="3" y="3" width="26" height="26" rx="6" />
    </svg>
  );
}
