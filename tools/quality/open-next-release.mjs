// The installed adapter owns cache layout. Certification happens after its
// deterministic static preparation, before any version upload can publish it.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

export async function prepareStaticCache(app) {
  const require = createRequire(join(app, "package.json"));
  const api = pathToFileURL(require.resolve("@opennextjs/cloudflare"));
  const [{ populateCache }, { NAME }] = await Promise.all([
    import(new URL("../cli/commands/populate-cache.js", api).href),
    import(new URL("./overrides/incremental-cache/static-assets-incremental-cache.js", api).href),
  ]);
  const configPath = join(app, ".open-next/.build/open-next.config.edge.mjs");
  const hash = createHash("sha256").update(readFileSync(configPath)).digest("hex");
  const { default: config } = await import(`${pathToFileURL(configPath).href}?source=${hash}`);
  const name = async (provider) => typeof provider === "function" ? (await provider()).name : provider;
  const override = config.default?.override;
  const tag = await name(override?.tagCache);
  if (config.dangerous?.disableIncrementalCache || await name(override?.incrementalCache) !== NAME || (!config.dangerous?.disableTagCache && tag !== undefined && tag !== "dummy")) throw new Error("cf: release preparation requires the configured static-assets cache and no remote tag cache");
  // The adapter copies only local files on this validated branch. No platform
  // proxy, workerd session or remote cache binding is needed for preparation.
  await populateCache({ outputDir: join(app, ".open-next") }, config, {}, { target: "local" }, {});
}
