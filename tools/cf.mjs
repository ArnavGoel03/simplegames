#!/usr/bin/env node
// The one fact a Cloudflare build cannot work out for itself.
//
// This site is built on this machine and then uploaded, so none of Cloudflare's
// own build variables exist while it runs. `src/lib/brand.ts` resolves the
// canonical origin and falls back to a hardcoded address; every canonical tag,
// OG image, sitemap entry and robots line on the site is built from it, and all
// of them are inlined at build time. So the address is set here, in a wrapper
// around the deploy command, rather than in `wrangler.jsonc`: by the time the
// Worker has an environment, the value is already in the bundle.
//
// An explicit `NEXT_PUBLIC_SITE_URL` in the environment wins, so a preview
// deployment on some other address can say so without editing this file.
//
// `cf:deploy` and `wrangler deploy` are not the same command. The adapter's
// deploy copies the prerendered pages into the Worker's static assets first,
// which is where `open-next.config.ts` reads them back from. Uploading with
// wrangler alone leaves that cache empty and every request re-renders a page
// that was already built.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { SITE_URL } from "./site-url.mjs";
import { invalidateBuild, sourceFingerprint, stampBuild, verifyBuild } from "./build-state.mjs";
import { writeHtmlPolicyWorker } from "./html-policy.mjs";
import { buildInfo } from "./build-info.mjs";
import { writeServiceWorker } from "./generate-worker.mjs";

const COMMANDS = new Set(["build", "preview", "deploy", "upload"]);
const [command, ...rest] = process.argv.slice(2);

if (!COMMANDS.has(command)) {
  console.error(`cf: expected one of ${[...COMMANDS].join(", ")}, got ${JSON.stringify(command)}`);
  process.exit(1);
}

try {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const buildEnvironment = { ...process.env, CLOUDFLARE_BUILD: command === "preview" ? "preview" : "production" };
  const releaseInfo = command === "build" ? buildInfo(root, buildEnvironment) : {};
  if (command === "build") await writeServiceWorker(root, { ...buildEnvironment, ...releaseInfo });
  const fingerprint = sourceFingerprint(root, SITE_URL);
  if (command === "build") invalidateBuild(root);
  else verifyBuild(root, fingerprint);

  const result = spawnSync("opennextjs-cloudflare", [command, ...rest], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...buildEnvironment,
      ...releaseInfo,
      NEXT_PUBLIC_SITE_URL: SITE_URL,
    },
  });

  // A signal is not an exit code. Neither a killed build nor a tree edited
  // during compilation can certify the bundle for a subsequent deployment.
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (command === "build") {
    if (sourceFingerprint(root, SITE_URL) !== fingerprint) {
      throw new Error("cf: source changed during the build. Run npm run cf:build again.");
    }
    writeHtmlPolicyWorker(root);
    stampBuild(root, fingerprint);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
