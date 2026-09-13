import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Public build facts, computed before Next inlines them into the release. */
export function buildInfo(root = fileURLToPath(new URL("../", import.meta.url)), env = process.env, now = new Date()) {
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (typeof version !== "string" || !version) throw new Error("Missing app version");
  let commit = env.NEXT_PUBLIC_APP_COMMIT || "";
  if (!commit) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root, encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      // A source archive has no revision to show.
    }
  }
  if (commit && !/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Invalid build revision");
  const builtAt = env.NEXT_PUBLIC_APP_BUILT_AT || `${now.toISOString().slice(0, 16)}Z`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(builtAt) || !Number.isFinite(Date.parse(builtAt))) {
    throw new Error("Invalid build timestamp");
  }
  return { NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_APP_COMMIT: commit, NEXT_PUBLIC_APP_BUILT_AT: builtAt };
}
