/** Remove reports queued by earlier studio releases without reading or sending them. */
export const LEGACY_STUDIO_DIAGNOSTIC_OUTBOX = "studio:diagnostics:outbox";

export function studioPrivacyCleanupSource() {
  return `try { localStorage.removeItem(${JSON.stringify(LEGACY_STUDIO_DIAGNOSTIC_OUTBOX)}); } catch {}`;
}
