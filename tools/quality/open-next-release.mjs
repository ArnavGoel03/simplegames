// The installed adapter owns cache layout. Certification happens after its
// deterministic static preparation, before any version upload can publish it.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// OpenNext Cloudflare 1.20.2 (AWS 4.1.0) serves full-page RSC when
// prefetchInlining is enabled. Next 16.3 reads its InliningHintsStale bit
// and repeats every prefetch. Keep static interception and let the adapter
// serve the separate segments instead.
export const OPEN_NEXT_EXPERIMENTAL_CONFIG = Object.freeze({ prefetchInlining: false });

export function requireCanonicalEnvironment(env, { nextApp = false } = {}) {
  for (const name of nextApp ? ["CLOUDFLARE_ENV", "NEXTJS_ENV"] : ["CLOUDFLARE_ENV"]) {
    if (env[name] !== undefined) throw new Error(`cf: ${name} cannot override a certified release target`);
  }
}

export function requireFreshNextBuild(args, env) {
  requireCanonicalEnvironment(env, { nextApp: true });
  // Help/version/config switches can also exit successfully without producing
  // a new Next build. A certified build accepts no command-line overrides.
  if (args.length) throw new Error("cf: certified builds accept no overriding arguments");
  if (["1", "true", "yes"].includes(String(env.SKIP_NEXT_APP_BUILD).toLowerCase())) throw new Error("cf: SKIP_NEXT_APP_BUILD cannot reuse an old Next build");
}

async function staticConfig(app) {
  const require = createRequire(join(app, "package.json"));
  const api = pathToFileURL(require.resolve("@opennextjs/cloudflare"));
  const { NAME } = await import(new URL("./overrides/incremental-cache/static-assets-incremental-cache.js", api).href);
  const configPath = join(app, ".open-next/.build/open-next.config.edge.mjs");
  const hash = createHash("sha256").update(readFileSync(configPath)).digest("hex");
  const { default: config } = await import(`${pathToFileURL(configPath).href}?source=${hash}`);
  const name = async (provider) => typeof provider === "function" ? (await provider()).name : provider;
  const override = config.default?.override;
  const tag = await name(override?.tagCache);
  if (config.dangerous?.disableIncrementalCache || await name(override?.incrementalCache) !== NAME || (!config.dangerous?.disableTagCache && tag !== undefined && tag !== "dummy")) throw new Error("cf: release preparation requires the configured static-assets cache and no remote tag cache");
  return { api, config, require };
}

export async function staticReleaseEnvironment(app, env = process.env) {
  const previous = process.env;
  process.env = { ...env };
  try {
    requireCanonicalEnvironment(process.env, { nextApp: true });
    const { api, config, require } = await staticConfig(app);
    if (config.cloudflare?.skewProtection?.enabled === true) throw new Error("cf: direct release requires disabled OpenNext skew protection");
    const [{ getNormalizedOptions }, { extractProjectEnvVars }] = await Promise.all([
      import(new URL("../cli/commands/utils/utils.js", api).href),
      import(new URL("../cli/utils/extract-project-env-vars.js", api).href),
    ]);
    const { unstable_readConfig, unstable_getVarsForDev } = require("wrangler");
    const wrangler = await unstable_readConfig({ config: join(app, "wrangler.jsonc") });
    // These are the installed parsers used by getEnvFromPlatformProxy. Preserve
    // its CLI environment precedence without starting a binding proxy: process,
    // Wrangler strings/.dev.vars, then missing Next production .env values.
    const bindings = unstable_getVarsForDev(wrangler.configPath, [], wrangler.vars, undefined, false, wrangler.secrets);
    for (const [key, binding] of Object.entries(bindings)) {
      if (["plain_text", "secret_text"].includes(binding.type) && typeof binding.value === "string") process.env[key] = binding.value;
    }
    requireCanonicalEnvironment(process.env, { nextApp: true });
    const dotEnv = extractProjectEnvVars("production", getNormalizedOptions(config, app));
    for (const [key, value] of Object.entries(dotEnv)) process.env[key] ??= value;
    requireCanonicalEnvironment(process.env, { nextApp: true });
    return { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false" };
  } finally { process.env = previous; }
}

export async function prepareStaticCache(app) {
  const { api, config } = await staticConfig(app);
  const { populateCache } = await import(new URL("../cli/commands/populate-cache.js", api).href);
  // The adapter copies only local files on this validated branch. No platform
  // proxy, workerd session or remote cache binding is needed for preparation.
  await populateCache({ outputDir: join(app, ".open-next") }, config, {}, { target: "local" }, {});
}
