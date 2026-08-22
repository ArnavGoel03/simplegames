// Holds this site to having exactly one place that knows what it is called.
//
// `brand.ts` names the studio and every game. That is only worth anything if
// nothing else writes a name down, and the games repository proved it is not
// automatic: when the studio became Glass Table Games, fifteen strings across
// four apps kept offering "Your Simple Games account" to players of a studio
// that had stopped using the name, because each had spelled it out instead of
// reading it. This site was clean on the day, which is not the same as being
// safe, and nothing here stopped it drifting the same way tomorrow.
//
// Two rules, matching `scripts/check-names.mjs` in the games repository so the
// two sides of one studio cannot disagree about what counts:
//
//   1. No retired name where a reader can see it.
//   2. The current name spelled out nowhere but `brand.ts`.
//
// Comments are exempt from both, JSX comments included. Half of what this
// repository knows about itself is written in comments explaining what a thing
// used to be called and why an id did not move with it, and that history is
// worth more than the check is. What a reader sees is a string, not a comment.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STUDIO_NAME } from "./brand";

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

/** The file allowed to spell the studio's name out. It is the source. */
const REGISTRY = join("lib", "brand.ts");

/**
 * Every display name this studio has retired.
 *
 * Draw is deliberately absent, though it became Charade on the same day. The
 * check matches text, and "draw" is what a player does to a card and what a
 * canvas is for, so listing it would report the deck and the canvas as a stale
 * brand forever. A name that is also an ordinary English word cannot be watched
 * this way, which is a cost of choosing one rather than a reason to weaken the
 * check.
 */
const RETIRED = ["Simple Games", "Chaupal", "Taash"] as const;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" || entry.name === "__vectors__"
        ? []
        : filesUnder(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Blanks out comments, keeping line numbers and every string literal intact.
 *
 * Whole-line and block comments only, which is where this repository writes
 * prose. A trailing `// like this` after code survives, and that is the safe
 * direction: the worst case is a comment reported as copy, which a reviewer
 * sees and moves, rather than a string silently truncated at the `//` inside a
 * URL with a stale name hiding behind it.
 */
function withoutComments(source: string): string {
  let inBlock = false;
  return source
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (inBlock) {
        if (trimmed.includes("*/")) inBlock = false;
        return "";
      }
      if (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) {
        if (!trimmed.includes("*/")) inBlock = true;
        return "";
      }
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return "";
      return line;
    })
    .join("\n");
}

/**
 * Matches a name as a name, bounded by something that is not a letter.
 *
 * A bare `includes` would report `chaupal-snakes-and-ladders.webp` and the
 * `chaupal` game id, which are storage keys and asset paths documented as
 * things that must not move. A retired name is a defect when a reader can see
 * it, not when it is half of an identifier nobody renders.
 */
function linesNaming(source: string, name: string): string[] {
  const pattern = new RegExp(
    `(^|[^A-Za-z])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`,
  );
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ line, number }) => `${number}: ${line.trim()}`);
}

/** This file, which lists every retired name, because listing them is its job. */
const REGISTER = join("lib", "names.test.ts");

const files = filesUnder(SRC)
  .map((path) => relative(SRC, path))
  .filter((path) => path !== REGISTER)
  .map((path) => ({
    path,
    copy: withoutComments(readFileSync(join(SRC, path), "utf8")),
  }));

describe("the names a reader sees", () => {
  it("reads at least the whole src tree", () => {
    // A check that silently scanned nothing would pass forever.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(RETIRED)("shows nobody the retired name %s", (retired) => {
    const found = files.flatMap(({ path, copy }) =>
      linesNaming(copy, retired).map((hit) => `${path}:${hit}`),
    );
    expect(found).toEqual([]);
  });

  it("spells the studio's name out only in brand.ts", () => {
    const found = files
      .filter(({ path }) => path !== REGISTRY)
      .flatMap(({ path, copy }) =>
        linesNaming(copy, STUDIO_NAME).map((hit) => `${path}:${hit}`),
      );
    expect(found).toEqual([]);
  });
});
