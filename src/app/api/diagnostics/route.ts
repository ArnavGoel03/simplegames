/** Retire delivery from older cached clients without reading or forwarding reports. */
export function POST() {
  return new Response(null, { status: 410, headers: { "Cache-Control": "no-store" } });
}
