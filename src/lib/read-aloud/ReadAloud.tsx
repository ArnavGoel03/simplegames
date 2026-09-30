"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { readingLoader } from "./read-aloud-loader";
import type { readingSession } from "./read-aloud";

/** Owner-approved copy belongs here. Empty slots retain existing control labels. */
const STOP_READING_EVENT = "play:stop-reading";
export const READ_ALOUD_COPY = { start: "", stop: "", unavailable: "", reading: "" } as const;
const capability = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const serverCapability = () => false;
const observeCapability = () => () => {};
export function ReadAloud({ target }: { target: string }) {
  const pathname = usePathname();
  const session = useRef<ReturnType<typeof readingSession> | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const loader = useRef<ReturnType<typeof readingLoader<typeof import("./read-aloud")>> | null>(null);
  if (loader.current === null) { loader.current = readingLoader(() => import("./read-aloud"), setPending); }
  const supported = useSyncExternalStore(observeCapability, capability, serverCapability);
  useEffect(() => {
    const stop = () => { loader.current?.cancel(); session.current?.stop(); session.current = null; setReading(false); };
    window.addEventListener(STOP_READING_EVENT, stop);
    window.addEventListener("pagehide", stop);
    window.addEventListener("popstate", stop);
    // Internal links stop immediately, before a route transition can complete.
    const navigate = (event: MouseEvent) => {
      const origin = event.target;
      const anchor = origin instanceof Element ? origin.closest("a[href]") : null;
      if (anchor) stop();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") stop(); };
    document.addEventListener("keydown", escape);
    document.addEventListener("click", navigate, true);
    return () => { stop(); window.removeEventListener(STOP_READING_EVENT, stop); window.removeEventListener("pagehide", stop); window.removeEventListener("popstate", stop); document.removeEventListener("click", navigate, true); document.removeEventListener("keydown", escape); };
  }, [pathname]);
  return <span data-read-aloud-control className="play-read-aloud">
    <button type="button" className="play-btn play-btn-secondary text-sm" disabled={!supported}
      aria-pressed={reading} aria-busy={pending} aria-controls={target} onClick={() => {
        if (reading || loader.current?.pending) { loader.current?.cancel(); session.current?.stop(); session.current = null; setReading(false); return; }
        const root = document.getElementById(target);
        if (!root) return;
        window.dispatchEvent(new Event(STOP_READING_EVENT));
        window.speechSynthesis.cancel();
        setFailed(false);
        void loader.current?.start(({ passagesFrom, rangeHighlighter, readingSession }) => {
          if (!root.isConnected) return;
          const highlighter = rangeHighlighter(root);
          session.current = readingSession(passagesFrom(root), window.speechSynthesis,
            text => new SpeechSynthesisUtterance(text), highlighter.show, highlighter.clear, () => setReading(false));
          setReading(true); session.current.start();
        }, () => { session.current?.stop(); session.current = null; setFailed(true); setReading(false); });
      }}>{reading ? READ_ALOUD_COPY.stop || "Stop" : READ_ALOUD_COPY.start || "Play"}</button>
    <span className="sr-only" role="status" aria-live="polite">{!supported || failed ? READ_ALOUD_COPY.unavailable : reading ? READ_ALOUD_COPY.reading : ""}</span>
  </span>;
}
