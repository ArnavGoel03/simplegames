import { ROUTES } from "../../lib/brand";
import { ASSET_RECOVERY_LIMITS } from "../../lib/pwa/asset-recovery";

/** This escape document must work without any stylesheet or external script. */
export function GET() {
  const home = JSON.stringify(ROUTES[0].path).replace(/</g, "\\u003c");
  return new Response(`<!doctype html><meta charset="utf-8"><script>(async()=>{
let timer;
const cleanup = async()=>{
try {
  if ("serviceWorker" in navigator) await Promise.allSettled((await navigator.serviceWorker.getRegistrations()).map(registration => registration.unregister()));
} catch {}
try {
  if ("caches" in window) await Promise.all((await caches.keys()).map(key => caches.delete(key)));
} catch {}
};
try {
  await Promise.race([cleanup(), new Promise(resolve=>{timer=setTimeout(resolve,${ASSET_RECOVERY_LIMITS.timeoutMs});})]);
} finally { clearTimeout(timer); location.replace(${home}); }
})().catch(()=>{});</script>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
