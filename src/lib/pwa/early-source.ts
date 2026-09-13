import { ERROR_TYPES, FAULT_OPERATIONS, MAX_DELIVERY_ATTEMPTS, MAX_QUEUED_REPORTS, MAX_REPORT_BYTES, MAX_REPORTS_PER_SESSION, OPERATIONAL_FAULTS, OPERATIONAL_FAULT_EVENT, REPORT_SCHEMA_VERSION, RETRYABLE_STATUSES, STARTUP_FAULT_FIELDS } from "./diagnostic-limits";

export interface EarlyDiagnosticsConfig {
  app: { version: string; commit: string | null; environment: string };
  outboxKey: string;
  worker?: boolean;
  earlyOnly?: boolean;
  readyEvent?: string;
  site?: string;
}

/** The same ingest contract and outbox, usable when external JavaScript failed. */
export function earlyDiagnosticsSource(config: EarlyDiagnosticsConfig): string {
  const value = JSON.stringify({ ...config, schema: REPORT_SCHEMA_VERSION,
    maximum: MAX_REPORTS_PER_SESSION, queued: MAX_QUEUED_REPORTS, attempts: MAX_DELIVERY_ATTEMPTS,
    codes: OPERATIONAL_FAULTS, operations: FAULT_OPERATIONS, errorTypes: ERROR_TYPES,
    maxBytes: MAX_REPORT_BYTES, retryable: RETRYABLE_STATUSES, faultEvent: OPERATIONAL_FAULT_EVENT,
    startupFields: STARTUP_FAULT_FIELDS }).replace(/</g, "\\u003c");
  return `const DIAGNOSTICS = ${value};
` + String.raw`
const faultSeen = new Set();
function faultId() { try { return crypto.randomUUID(); } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2); } }
const faultSession = faultId();
let diagnosticsHydrated = typeof window !== "undefined" && DIAGNOSTICS.readyEvent && window[DIAGNOSTICS.readyEvent] === true;
function faultDevice() {
  const win = typeof window === "undefined" ? null : window;
  const media = query => { try { return win?.matchMedia(query).matches || false; } catch { return false; } };
  return { userAgent: navigator.userAgent || "unknown", platform: navigator.platform || null,
    language: navigator.language || "unknown", viewport: { width: win?.innerWidth || 0, height: win?.innerHeight || 0 },
    devicePixelRatio: win?.devicePixelRatio || 1, memoryGb: null, cpuCores: null,
    connection: navigator.connection?.effectiveType || null, online: navigator.onLine !== false,
    standalone: media("(display-mode: standalone)") || navigator.standalone === true,
    prefersReducedMotion: media("(prefers-reduced-motion: reduce)"), colorScheme: media("(prefers-color-scheme: dark)") ? "dark" : "light", timezone: null };
}
function faultQueue() {
  try {
    const raw = localStorage.getItem(DIAGNOSTICS.outboxKey);
    if (!raw || raw.length > DIAGNOSTICS.maxBytes * DIAGNOSTICS.queued * 1.1) return [];
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows.filter(row => row?.report?.id && Number.isInteger(row.attempts)).slice(-DIAGNOSTICS.queued) : [];
  } catch { return []; }
}
function saveFaultQueue(rows) {
  try { localStorage.setItem(DIAGNOSTICS.outboxKey, JSON.stringify(rows.slice(-DIAGNOSTICS.queued))); } catch {}
}
async function deliverFault(report) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  let settled = false;
  try {
    const response = await fetch("/api/diagnostics", { method: "POST", credentials: "omit", keepalive: true,
      headers: { "content-type": "application/json" }, body: JSON.stringify(report), signal: controller.signal });
    settled = (response.ok && response.headers.get("x-diagnostic-id") === report.id) ||
      (response.status >= 400 && response.status < 500 && !DIAGNOSTICS.retryable.includes(response.status));
  } catch {} finally { clearTimeout(timer); }
  if (!DIAGNOSTICS.worker) saveFaultQueue(faultQueue().flatMap(row => row.report.id !== report.id ? [row] :
    settled || row.attempts + 1 >= DIAGNOSTICS.attempts ? [] : [{ ...row, attempts: row.attempts + 1 }]));
}
function reportOperationalFault(code, details = {}) {
  try {
    if (!DIAGNOSTICS.codes.includes(code)) return Promise.resolve();
    const operation = DIAGNOSTICS.operations.includes(details.operation) ? details.operation : "pwa";
    const errorType = DIAGNOSTICS.errorTypes.includes(details.errorType) ? details.errorType : undefined;
    const status = Number.isInteger(details.status) && details.status >= 0 && details.status <= 599 ? details.status : undefined;
    const startup = {};
    for (const [name, rule] of Object.entries(DIAGNOSTICS.startupFields)) {
      const value = details[name];
      if (rule.kind === "boolean" ? typeof value === "boolean" : typeof value === "string" &&
        (rule.kind === "enum" ? rule.values.includes(value) : value.length <= rule.max && new RegExp(rule.pattern).test(value))) startup[name] = value;
    }
    const key = code + ":" + operation + ":" + (status || "");
    if (faultSeen.has(key) || faultSeen.size >= DIAGNOSTICS.maximum) return Promise.resolve();
    faultSeen.add(key);
    const stack = typeof details.stack === "string" ? details.stack.slice(0, 4000).split("\n").slice(0, 12)
      .flatMap(line => line.match(/\/_next\/static\/[a-z0-9_./-]+:\d+(?::\d+)?/i)?.[0] || []).join("\n") || null : null;
    const report = { schema: DIAGNOSTICS.schema, id: faultId(), sessionId: faultSession,
      kind: "error", fingerprint: key, message: code, stack, occurredAt: new Date().toISOString(),
      app: DIAGNOSTICS.app, device: faultDevice(), replay: null,
      breadcrumbs: [{ at: 0, kind: "state", message: "operational failure", data: { code, operation,
        ...(DIAGNOSTICS.site ? { site: DIAGNOSTICS.site } : {}),
        ...(status === undefined ? {} : { status }), ...(errorType ? { errorType } : {}), ...startup } }] };
    if (!DIAGNOSTICS.worker) saveFaultQueue([...faultQueue(), { report, attempts: 0 }]);
    return deliverFault(report);
  } catch { return Promise.resolve(); }
}
if (!DIAGNOSTICS.worker && typeof window !== "undefined") {
  if (DIAGNOSTICS.readyEvent) window.addEventListener(DIAGNOSTICS.readyEvent, () => { diagnosticsHydrated = true; });
  window.addEventListener(DIAGNOSTICS.faultEvent, event => {
    if (event.detail && typeof event.detail === "object") void reportOperationalFault(event.detail.code, event.detail);
  });
  window.addEventListener("error", event => {
    if ((!diagnosticsHydrated || DIAGNOSTICS.earlyOnly === false) && event.error && !String(event.message || "").startsWith("ResizeObserver loop"))
      void reportOperationalFault("app-exception", { operation: "application", errorType: event.error.name, stack: event.error.stack });
  });
  window.addEventListener("unhandledrejection", event => {
    if (!diagnosticsHydrated || DIAGNOSTICS.earlyOnly === false) void reportOperationalFault("app-rejection", { operation: "application", errorType: event.reason?.name, stack: event.reason?.stack });
  });
  // No timers or scheduled jobs: retry only when this document opens or its
  // connection returns. A hydrated app shares and acknowledges this outbox.
  const retryFaults = () => { if (navigator.onLine !== false) for (const row of faultQueue()) void deliverFault(row.report); };
  window.addEventListener("online", retryFaults);
  retryFaults();
}
`;
}
