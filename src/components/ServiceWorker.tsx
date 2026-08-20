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
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
