// Structured data, emitted safely.
//
// JSON-LD is a script body, not markup, so React's normal text escaping is the
// wrong tool and would corrupt the JSON. The one sequence that can end the
// script element early is `</`, and escaping the `<` as a JSON unicode escape
// leaves the parsed value byte-identical while making that impossible.
//
// The same file exists in the games repository, at
// `packages/studio/src/seo/JsonLd.tsx`, for the same reason the fairness
// derivation exists in both: this site is a separate deployment and cannot
// import that one. Six lines, no dependencies, and nothing about it is likely
// to change; if it does, both copies change.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
