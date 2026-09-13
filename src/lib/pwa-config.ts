import { ROUTES } from "./brand";
import type { ServiceWorkerRoute } from "./pwa/service-worker";

/** Presentation and routes belong here; cache and recovery behavior are mirrored. */
export const STUDIO_WORKER_CONFIG = {
  app: "glasstable-studio",
  legacyCachePrefixes: ["shell-", "assets-"],
  precache: [...ROUTES.map(({ path }) => path), "/icon.svg", "/manifest.webmanifest"],
  escape: "/reset",
  startUrl: "/",
  offline: "/",
  offlineForeground: "#faf4ea",
  runtimeNote: "// Public studio pages and their complete offline dependencies.",
} satisfies Omit<ServiceWorkerRoute, "appVersion" | "appCommit">;

export const STUDIO_DIAGNOSTIC_OUTBOX = "studio:diagnostics:outbox";
export const STUDIO_DIAGNOSTIC_SITE = "studio";
