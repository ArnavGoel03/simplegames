"use client";

import { useEffect, useState } from "react";
import { startWorkerClient } from "../lib/pwa/worker-client";

/** The footer presentation stays local; registration and recovery are shared. */
export function ServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => startWorkerClient(() => setUpdateReady(true)), []);
  return updateReady ? <span role="status">A new version is ready</span> : null;
}
