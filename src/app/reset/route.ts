import { ROUTES } from "../../lib/brand";

/** This escape document must work without any stylesheet or external script. */
export function GET() {
  const home = JSON.stringify(ROUTES[0].path).replace(/</g, "\\u003c");
  return new Response(`<!doctype html><meta charset="utf-8"><script>(async()=>{
try {
  if ("serviceWorker" in navigator) await Promise.allSettled((await navigator.serviceWorker.getRegistrations()).map(registration => registration.unregister()));
} catch {}
try {
  if ("caches" in window) await Promise.all((await caches.keys()).map(key => caches.delete(key)));
} finally { location.replace(${home}); }
})().catch(()=>{});</script>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
