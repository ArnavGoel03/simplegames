import { describe, expect, it } from "vitest";
import manifest from "./manifest";
import { PLAYABLE } from "../lib/brand";

describe("installed studio game shortcuts", () => {
  it("uses each game's published icon instead of repeating the studio icon", () => {
    const shortcuts = manifest().shortcuts ?? [];
    expect(shortcuts).toHaveLength(PLAYABLE.length);
    const urls = shortcuts.map((shortcut, index) => {
      expect(shortcut.icons?.[0]).toMatchObject({ src: PLAYABLE[index].icon.src,
        sizes: PLAYABLE[index].icon.sizes, type: PLAYABLE[index].icon.type });
      const source = shortcut.icons?.[0].src ?? "";
      expect(new URL(source).origin).toBe(new URL(PLAYABLE[index].url).origin);
      return source;
    });
    expect(new Set(urls).size).toBe(PLAYABLE.length);
  });
});
