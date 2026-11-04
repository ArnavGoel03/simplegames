export const OFFLINE_STATUS_MESSAGE = "gtg:offline-status";
export const OFFLINE_DOWNLOAD_MESSAGE = "gtg:offline-download";
export const OFFLINE_WORKER_NOT_READY = "offline-worker-not-ready";
/** Same bounded route budget for worker manifests and client responses. */
export const MAX_OFFLINE_PATHS = 256;
/** Local status is quick; a bounded download can fill several game routes. */
const STATUS_TIMEOUT_MS = 4000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
/** Two status retries recover transient failures without indefinite polling or automatic downloads. */
const STATUS_RETRY_DELAYS_MS = [1000, 2000] as const;

export interface OfflineReadiness {
  readonly version: string | null;
  readonly ready: boolean;
  readonly paths: readonly string[];
  readonly missing: readonly string[];
  readonly backupVersions: readonly string[];
  readonly error?: string;
}

function failedReadiness(error: string, paths?: readonly string[]): OfflineReadiness {
  return { version: null, ready: false, paths: [], missing: paths ?? [], backupVersions: [], error };
}

function parseReadiness(value: unknown): OfflineReadiness | null {
  if (typeof value !== "object" || value === null || !("type" in value) || value.type !== OFFLINE_STATUS_MESSAGE ||
    !("version" in value) || typeof value.version !== "string" || !("ready" in value) || typeof value.ready !== "boolean" ||
    !("paths" in value) || !Array.isArray(value.paths) || !("missing" in value) || !Array.isArray(value.missing) ||
    !("backupVersions" in value) || !Array.isArray(value.backupVersions)) return null;
  for (const list of [value.paths, value.missing, value.backupVersions]) {
    if (list.length > MAX_OFFLINE_PATHS || list.some((entry: unknown) => typeof entry !== "string" || entry.length > 2048)) return null;
  }
  return { version: value.version, ready: value.ready, paths: value.paths as string[], missing: value.missing as string[],
    backupVersions: value.backupVersions as string[], ...("error" in value && typeof value.error === "string" ? { error: value.error } : {}) };
}

async function request(type: typeof OFFLINE_STATUS_MESSAGE | typeof OFFLINE_DOWNLOAD_MESSAGE, paths?: readonly string[]): Promise<OfflineReadiness> {
  const failed = (error: string) => failedReadiness(error, paths);
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return failed("offline-worker-unsupported");
  const worker = navigator.serviceWorker.controller;
  if (!worker) return failed(OFFLINE_WORKER_NOT_READY);
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    const finish = (result: OfflineReadiness) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(result); };
    const timer = setTimeout(() => finish(failed("offline-worker-timeout")), type === OFFLINE_DOWNLOAD_MESSAGE ? DOWNLOAD_TIMEOUT_MS : STATUS_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(parseReadiness(event.data) ?? failed("offline-worker-invalid-response"));
    channel.port1.onmessageerror = () => finish(failed("offline-worker-invalid-response"));
    try { worker.postMessage({ type, ...(paths ? { paths: [...paths] } : {}) }, [channel.port2]); }
    catch { finish(failed("offline-worker-unavailable")); }
  });
}

export function requestOfflineReadiness(paths?: readonly string[]): Promise<OfflineReadiness> {
  return request(OFFLINE_STATUS_MESSAGE, paths);
}

export function downloadOfflineCopy(paths?: readonly string[]): Promise<OfflineReadiness> {
  return request(OFFLINE_DOWNLOAD_MESSAGE, paths);
}

export interface OfflineReadinessSubscription {
  refresh(): Promise<void>;
  download(): Promise<void>;
  dispose(): void;
}

/** Controller replacement and page restoration invalidate any older reply. */
export function subscribeOfflineReadiness(
  publish: (readiness: OfflineReadiness) => void,
  paths?: readonly string[],
): OfflineReadinessSubscription {
  const worker = typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : null;
  const page = typeof window !== "undefined" ? window : null;
  let disposed = false, generation = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const clearRetry = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const check = async (read: () => Promise<OfflineReadiness>, current: number, retryIndex: number | null): Promise<void> => {
    if (disposed || current !== generation) return;
    const result = await read().catch(() => failedReadiness("offline-worker-unavailable", paths));
    if (disposed || current !== generation) return;
    publish(result);
    const delay = retryIndex === null ? undefined : STATUS_RETRY_DELAYS_MS[retryIndex];
    if (disposed || current !== generation || delay === undefined || retryIndex === null ||
      (result.error !== "offline-worker-timeout" && result.error !== "offline-worker-unavailable")) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void check(read, current, retryIndex + 1);
    }, delay);
  };
  const start = (read: () => Promise<OfflineReadiness>, retryIndex: number | null) => {
    if (disposed) return Promise.resolve();
    clearRetry();
    return check(read, ++generation, retryIndex);
  };
  const refresh = () => start(() => requestOfflineReadiness(paths), 0);
  const changed = () => { void refresh(); };
  worker?.addEventListener("controllerchange", changed);
  page?.addEventListener("pageshow", changed);
  changed();
  return {
    refresh,
    download: () => start(() => downloadOfflineCopy(paths), null),
    dispose: () => {
      disposed = true; generation++; clearRetry();
      worker?.removeEventListener("controllerchange", changed);
      page?.removeEventListener("pageshow", changed);
    },
  };
}
