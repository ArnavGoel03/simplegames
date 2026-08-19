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

/** Where this Worker answers. `name` in `wrangler.jsonc` decides it. */
const SITE_URL = "https://glasstablegames.goelhome.workers.dev";

const COMMANDS = new Set(["build", "preview", "deploy", "upload"]);
const [command, ...rest] = process.argv.slice(2);

if (!COMMANDS.has(command)) {
  console.error(`cf: expected one of ${[...COMMANDS].join(", ")}, got ${JSON.stringify(command)}`);
  process.exit(1);
}

const result = spawnSync("opennextjs-cloudflare", [command, ...rest], {
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_BUILD: command === "preview" ? "preview" : "production",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL,
  },
});

// A signal is not an exit code, and reporting one as success is how a killed
// build gets deployed by whatever runs next.
process.exit(result.status ?? 1);
