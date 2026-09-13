import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const receipt = JSON.parse(readFileSync(new URL("./quality/source.json", import.meta.url), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
describe("the canonical release engine mirror", () => {
  it("retains the complete unedited engine and its regression tests", () => {
    expect(receipt.sourceHead).toMatch(/^[a-f0-9]{40}$/);
    expect(Object.keys(receipt.files).sort()).toEqual(["open-next-release.mjs", "quality-runtime.mjs", "quality-runtime.node-spec.mjs", "release-policy.mjs", "release-policy.node-spec.mjs"]);
    for (const [name, digest] of Object.entries(receipt.files)) {
      const bytes = readFileSync(new URL(`./quality/${name}`, import.meta.url));
      expect(hash(bytes)).toBe(digest);
      expect(hash(Buffer.concat([bytes, Buffer.from("// substituted")]))).not.toBe(digest);
    }
  });
});
