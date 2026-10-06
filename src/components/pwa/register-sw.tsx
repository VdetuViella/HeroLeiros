"use client";

import { useEffect } from "react";

/** Registra el service worker que cacha samples y canciones. No toca el AudioContext. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
