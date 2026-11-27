"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sendLoaded = (sw: ServiceWorker | null) => {
      if (!sw) return;
      const urls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin));
      sw.postMessage({ type: "cache-urls", urls });
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async () => {
        const reg = await navigator.serviceWorker.ready;
        sendLoaded(reg.active);
        if (navigator.onLine) reg.active?.postMessage({ type: "refresh-shell" });
      })
      .catch(() => undefined);
  }, []);
  return null;
}
