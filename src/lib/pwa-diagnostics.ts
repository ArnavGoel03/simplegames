import { earlyDiagnosticsSource } from "./pwa/early-source";
import { ASSET_READY_EVENT } from "./pwa/asset-recovery";
import { STUDIO_DIAGNOSTIC_OUTBOX, STUDIO_DIAGNOSTIC_SITE } from "./pwa-config";

export function studioDiagnosticsSource(worker = false) {
  return earlyDiagnosticsSource({
    app: {
      version: process.env.NEXT_PUBLIC_APP_VERSION || "",
      commit: process.env.NEXT_PUBLIC_APP_COMMIT || null,
      environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT || "development",
    },
    outboxKey: STUDIO_DIAGNOSTIC_OUTBOX,
    site: STUDIO_DIAGNOSTIC_SITE,
    worker,
    earlyOnly: false,
    readyEvent: ASSET_READY_EVENT,
  });
}
