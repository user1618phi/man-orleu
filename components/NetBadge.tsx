"use client";

import { useSyncExternalStore } from "react";
import { T } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function NetBadge({ lang, queued }: { lang: Lang; queued: number }) {
  const online = useOnline();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className={`mark ${online ? "ok" : "warn"}`}>{online ? T.online[lang] : T.offline[lang]}</span>
      {queued > 0 && (
        <span className="mark info num">
          {queued} {T.queue[lang]}
        </span>
      )}
    </div>
  );
}
