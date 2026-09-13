import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInfo } from "./build-info.mjs";

export async function writeServiceWorker(root, env = process.env) {
  const result = await build({
    stdin: { contents: 'export { serviceWorkerSource } from "./src/lib/pwa/service-worker"; export { STUDIO_WORKER_CONFIG, STUDIO_DIAGNOSTIC_OUTBOX, STUDIO_DIAGNOSTIC_SITE } from "./src/lib/pwa-config"; export { earlyDiagnosticsSource } from "./src/lib/pwa/early-source";', resolveDir: root },
    bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
  });
  const { serviceWorkerSource, STUDIO_WORKER_CONFIG, STUDIO_DIAGNOSTIC_OUTBOX, STUDIO_DIAGNOSTIC_SITE, earlyDiagnosticsSource } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  const info = buildInfo(root, env);
  const faultSource = earlyDiagnosticsSource({ app: { version: info.NEXT_PUBLIC_APP_VERSION, commit: info.NEXT_PUBLIC_APP_COMMIT || null, environment: info.NEXT_PUBLIC_APP_ENVIRONMENT }, outboxKey: STUDIO_DIAGNOSTIC_OUTBOX, site: STUDIO_DIAGNOSTIC_SITE, worker: true });
  const source = serviceWorkerSource({ ...STUDIO_WORKER_CONFIG, faultSource, appVersion: info.NEXT_PUBLIC_APP_VERSION, appCommit: info.NEXT_PUBLIC_APP_COMMIT || null });
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(join(root, "public/sw.js"), source);
  return source;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await writeServiceWorker(fileURLToPath(new URL("../", import.meta.url)));
