import { ROUTES } from "./brand";
import { studioIconPath } from "./studio-mark";
import type { ServiceWorkerRoute } from "./pwa/service-worker";

/** Presentation and routes belong here; cache and recovery behavior are mirrored. */
export const STUDIO_WORKER_CONFIG = {
  app: "glasstable-studio",
  legacyCachePrefixes: ["shell-", "assets-"],
  precache: [...ROUTES.map(({ path }) => path), studioIconPath("icon.svg"), "/manifest.webmanifest"],
  escape: "/reset",
  startUrl: "/",
  offline: "/",
  offlineForeground: "#faf4ea",
  runtimeNote: "// Public studio pages and their complete offline dependencies.",
} satisfies Omit<ServiceWorkerRoute, "appVersion" | "appCommit">;
