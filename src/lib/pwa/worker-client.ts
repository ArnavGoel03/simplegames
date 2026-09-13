import { ASSET_READY_EVENT, ASSET_RECOVERY_EVENT } from "./asset-recovery";

export const WORKER_UPDATE_COOLDOWN_MS = 30_000;

export interface WorkerFault { code: "pwa-register" | "pwa-update"; operation: "pwa"; errorType?: string }

/** One registration lifecycle, including restored installed windows. */
export function startWorkerClient(notify: () => void, reportFault?: (fault: WorkerFault) => void): () => void {
  window.dispatchEvent(new Event(ASSET_READY_EVENT));
  if (!("serviceWorker" in navigator)) return () => {};
  let disposed = false;
  const fault = (code: WorkerFault["code"], error: unknown) => {
    if (disposed) return;
    try { reportFault?.({ code, operation: "pwa", ...(error instanceof Error ? { errorType: error.name } : {}) }); } catch { /* Diagnostics cannot interrupt recovery. */ }
  };
  let registration: ServiceWorkerRegistration | null = null;
  let registering: Promise<void> | null = null;
  let updating = false;
  let lastUpdate = -Infinity;
  const observed = new Map<ServiceWorker, () => void>();
  const announced = new Set<ServiceWorker>();
  const takeOver = (worker: ServiceWorker) => {
    if (disposed || announced.has(worker)) return;
    announced.add(worker);
    worker.postMessage("skip-waiting");
    notify();
  };
  const watch = () => {
    if (!registration || disposed) return;
    if (registration.waiting) takeOver(registration.waiting);
    const worker = registration.installing;
    if (!worker || observed.has(worker)) return;
    const changed = () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) takeOver(worker);
    };
    observed.set(worker, changed);
    worker.addEventListener("statechange", changed);
    changed();
  };
  const update = async () => {
    if (disposed || updating || navigator.onLine === false || document.visibilityState === "hidden"
      || Date.now() - lastUpdate < WORKER_UPDATE_COOLDOWN_MS) return;
    if (!registration) return;
    updating = true;
    lastUpdate = Date.now();
    try { await registration.update(); } catch (error) { fault("pwa-update", error); }
    finally { updating = false; }
  };
  const check = () => {
    if (disposed || navigator.onLine === false || document.visibilityState === "hidden") return;
    if (registration) { void update(); return; }
    if (registering) return;
    registering = navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((reg) => {
      if (disposed) return;
      registration = reg;
      reg.addEventListener("updatefound", watch);
      watch();
      return update();
    }).catch((error: unknown) => { fault("pwa-register", error); }).finally(() => { registering = null; });
  };
  window.addEventListener("pageshow", check);
  window.addEventListener("online", check);
  document.addEventListener("visibilitychange", check);
  window.addEventListener(ASSET_RECOVERY_EVENT, notify);
  // Registration does not depend on every image or third-party request loading.
  check();
  return () => {
    disposed = true;
    window.removeEventListener("pageshow", check);
    window.removeEventListener("online", check);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener(ASSET_RECOVERY_EVENT, notify);
    registration?.removeEventListener("updatefound", watch);
    for (const [worker, changed] of observed) worker.removeEventListener("statechange", changed);
  };
}
