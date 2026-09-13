"use client";

import { useEffect, useState } from "react";
import { OPERATIONAL_FAULT_EVENT } from "../lib/pwa/diagnostic-limits";
import { startWorkerClient } from "../lib/pwa/worker-client";

/** The footer presentation stays local; registration and recovery are shared. */
export function ServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => startWorkerClient(() => setUpdateReady(true), (detail) => {
    window.dispatchEvent(new CustomEvent(OPERATIONAL_FAULT_EVENT, { detail }));
  }), []);
  return updateReady ? <span role="status">A new version is ready</span> : null;
}
