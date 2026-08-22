"use client";

import { useEffect } from "react";

// Registers the worker, and only once the page has finished loading.
//
// Registering during render competes with the page's own requests for the one
// thing this site sells, which is arriving instantly. The install is worth a
// second visit, not a slower first one.
//
// It fails quietly on purpose. A browser with service workers disabled, a
// private window, or an insecure origin will reject this, and none of those are
// a reason to put an error in a player's console on a site that works perfectly
// without it.
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    /*
      A page whose build has been replaced under it, reloaded once.

      Next names every chunk by the hash of its contents, and Cloudflare's asset
      store holds one set of them: the current one. So the moment a deploy lands,
      a document that was already open is asking for filenames that no longer
      exist. The stylesheet 404s and the browser draws the raw document, which is
      a page of stacked links in a serif nobody chose. It happened to this site
      on a phone on 22 August and to the card site an hour later, both times
      while I was deploying underneath somebody.

      A new worker taking control is the one signal that says the ground moved,
      so that is what this listens for. `controllerchange` fires when a worker
      that skipped waiting claims the page, which is exactly the moment the old
      document became unservable.

      Once, and guarded. A reload that can retrigger its own listener is a page
      that reloads forever, and doing this to somebody mid-game to fix a
      stylesheet would be the worse bug of the two.
    */
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
