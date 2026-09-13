// Kept dependency-free so the pre-hydration reporter can also ship in the
// separately built studio index without pulling in a game engine.
export const REPORT_SCHEMA_VERSION = 1;
export const MAX_REPORT_BYTES = 64 * 1024;
export const RETRYABLE_STATUSES: readonly number[] = [408, 429];
export const OPERATIONAL_FAULT_EVENT = "gtg:operational-fault";
export const MAX_REPORTS_PER_SESSION = 10;
export const MAX_QUEUED_REPORTS = 20;
export const MAX_DELIVERY_ATTEMPTS = 5;
export const OPERATIONAL_FAULTS = [
  "app-exception", "app-rejection", "pwa-missing-style", "pwa-missing-script",
  "pwa-recovery", "pwa-cache-write", "pwa-precache", "pwa-offline-incomplete",
  "pwa-register", "pwa-update", "network-unavailable", "network-http",
  "network-invalid-response", "room-protocol", "room-connect",
] as const;
export type OperationalFault = (typeof OPERATIONAL_FAULTS)[number];
export const FAULT_OPERATIONS = ["pwa", "casino", "wallet", "room", "room-ticket", "queue", "application"] as const;
export const ERROR_TYPES = ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError", "AbortError", "QuotaExceededError"] as const;
