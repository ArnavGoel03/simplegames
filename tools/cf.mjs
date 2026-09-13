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
// `cf:build` prepares the adapter's static cache before certifying its bytes.
// `cf:upload` records an immutable candidate; `cf:deploy` promotes that tested
// version. Uploading an unprepared bundle leaves the cache empty and every
// request re-renders a page that was already built.

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

import { SITE_URL } from "./site-url.mjs";
import { invalidateBuild, stampBuild, verifyBuild } from "./build-state.mjs";
import { writeHtmlPolicyWorker } from "./html-policy.mjs";
import { buildInfo } from "./build-info.mjs";
import { writeServiceWorker } from "./generate-worker.mjs";

import { root, identity, buildSource, gateCommand, policy, workerName, previewOrigin } from "./release-context.mjs";
import { commandOutcome, promoteCandidate, readJson, receiptPath, requireRelease, runRecorded, writeJson } from "./quality/quality-runtime.mjs";
import { parseUploadedVersion } from "./quality/release-policy.mjs";
import { prepareStaticCache, requireCanonicalEnvironment, requireFreshNextBuild, staticReleaseEnvironment } from "./quality/open-next-release.mjs";

const COMMANDS = new Set(["build", "preview", "deploy", "upload"]);
const [command, ...rest] = process.argv.slice(2);

if (!COMMANDS.has(command)) {
  console.error(`cf: expected one of ${[...COMMANDS].join(", ")}, got ${JSON.stringify(command)}`);
  process.exit(1);
}

try {
  if (command === "build") invalidateBuild(root);
  if (command !== "preview") {
    if (rest.length) throw new Error("cf: build and release commands accept no overriding arguments");
    if (command === "build") requireFreshNextBuild(rest, process.env);
    else requireCanonicalEnvironment(process.env, { nextApp: true });
    if (process.env.NEXT_PUBLIC_APP_ENVIRONMENT && process.env.NEXT_PUBLIC_APP_ENVIRONMENT !== "production") throw new Error("cf: production build attribution cannot be overridden");
    if (process.env.NEXT_PUBLIC_APP_COMMIT && process.env.NEXT_PUBLIC_APP_COMMIT !== identity().sourceHead) throw new Error("cf: build revision must match the current source HEAD");
  }
  const buildEnvironment = { ...process.env, CLOUDFLARE_BUILD: command === "preview" ? "preview" : "production" };
  const releaseInfo = command === "build" ? buildInfo(root, buildEnvironment) : {};
  if (command === "build") await writeServiceWorker(root, { ...buildEnvironment, ...releaseInfo });
  const fingerprint = buildSource();
  const certified = command !== "build" && command !== "deploy" ? verifyBuild(root, fingerprint) : null;
  const env = { ...buildEnvironment, ...releaseInfo, NEXT_PUBLIC_SITE_URL: SITE_URL };
  if (command === "deploy") {
    const validate = () => {
      const candidate = readJson(receiptPath(root, "candidates", "studio.json"));
      return requireRelease({ root, site: "studio", identity: identity(), command: gateCommand,
        expectedCandidate: { worker: workerName(), buildSource: buildSource(), origin: previewOrigin(candidate.candidateVersion) }, policy: policy() });
    };
    const releaseEnv = await staticReleaseEnvironment(root, env);
    await promoteCandidate({ root, site: "studio", cwd: root, env: releaseEnv, validate });
    process.exit(0);
  }
  if (command === "upload") {
    const before = identity();
    const path = receiptPath(root, "candidates", "studio.json");
    rmSync(path, { force: true });
    rmSync(receiptPath(root, "releases", "studio.json"), { force: true });
    const releaseEnv = await staticReleaseEnvironment(root, env);
    const result = await runRecorded("wrangler", ["versions", "upload"], { cwd: root, env: releaseEnv, log: receiptPath(root, "candidates", "studio-upload.log") });
    if (result.exitCode !== 0 || result.signal !== null || result.error) throw new Error("cf: candidate upload failed; no receipt written");
    if (buildSource() !== fingerprint || JSON.stringify(identity()) !== JSON.stringify(before)) throw new Error("cf: source changed during upload");
    const after = verifyBuild(root, fingerprint);
    if (after.outputHash !== certified.outputHash || after.buildId !== certified.buildId) throw new Error("cf: certified output changed during upload; no receipt written");
    const candidateVersion = parseUploadedVersion(result.output);
    const candidate = { schema: 1, kind: "candidate", site: "studio", worker: workerName(), ...before,
      buildSource: certified.fingerprint, buildOutput: certified.outputHash, candidateVersion,
      origin: previewOrigin(candidateVersion), recordedAt: new Date().toISOString(), upload: commandOutcome(result) };
    writeJson(path, candidate);
    console.log(`cf: candidate ${candidateVersion} recorded before promotion: ${candidate.origin}`);
    process.exit(0);
  }

  if (command === "preview") {
    const result = spawnSync("opennextjs-cloudflare", [command, ...rest], { cwd: root, stdio: "inherit", env });
    process.exit(result.status ?? 1);
  }

  const result = await runRecorded("opennextjs-cloudflare", ["build"], { cwd: root, env, log: receiptPath(root, "builds", "studio-build.log") });
  if (result.exitCode !== 0 || result.signal !== null || result.error) throw new Error("cf: build failed; no certificate written");
  // The upload runs this same OpenNext transform. Certify the prepared bytes so
  // upload cannot silently change the tree covered by the browser receipt.
  await prepareStaticCache(root);
  if (buildSource() !== fingerprint) throw new Error("cf: source changed during the build. Run npm run cf:build again.");
  writeHtmlPolicyWorker(root);
  stampBuild(root, fingerprint);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
