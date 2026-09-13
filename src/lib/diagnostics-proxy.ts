import catalogue from "./game-catalogue.json";
import { MAX_REPORT_BYTES } from "./pwa/diagnostic-limits";

export const DIAGNOSTIC_PROXY_TIMEOUT_MS = 5_000;
const circuit = catalogue.sites.find(site => site.id === "chaupal");
if (!circuit) throw new Error("Canonical diagnostics origin is missing");
const upstream = new URL("/api/diagnostics", circuit.url);

async function cappedBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), DIAGNOSTIC_PROXY_TIMEOUT_MS); });
  try {
    for (;;) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part === null) { void reader.cancel().catch(() => {}); throw new Error("diagnostic body timeout"); }
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => {}); return null; }
      chunks.push(part.value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(result);
  } finally { clearTimeout(timer); }
}

/** One ingestion and owner pipeline; no account credentials cross this proxy. */
export async function diagnosticsProxy(request: Request): Promise<Response> {
  const refuse = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });
  const origin = request.headers.get("origin");
  if (origin !== null) {
    try { if (new URL(origin).origin !== new URL(request.url).origin) return refuse(403); }
    catch { return refuse(403); }
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return refuse(415);
  if (Number(request.headers.get("content-length")) > MAX_REPORT_BYTES) return refuse(413);
  let body: string | null;
  try { body = await cappedBody(request.body, MAX_REPORT_BYTES); } catch { return refuse(503); }
  if (body === null) return refuse(413);
  try { JSON.parse(body); } catch { return refuse(400); }
  let response: Response;
  try {
    response = await fetch(upstream, {
      method: "POST", redirect: "error", credentials: "omit", cache: "no-store",
      headers: { "content-type": "application/json", origin: upstream.origin }, body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch { return refuse(503); }
  const headers = new Headers({ "cache-control": "no-store" });
  for (const name of ["content-type", "retry-after", "x-diagnostic-id"]) {
    const value = response.headers.get(name); if (value !== null) headers.set(name, value);
  }
  if (response.status === 204) return new Response(null, { status: 204, headers });
  let answer: string | null;
  try { answer = await cappedBody(response.body, 8_192); } catch { return refuse(503); }
  if (answer === null) return refuse(503);
  return new Response(answer, { status: response.status, headers });
}
