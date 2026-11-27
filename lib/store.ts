"use client";

import { get, set } from "idb-keyval";
import type { Attempt, Lang, Level, OutboxItem } from "./types";

export interface Settings {
  lang: Lang;
  name: string;
  level: Level;
  streak: number;
}

const K = { settings: "man:settings", attempts: "man:attempts", outbox: "man:outbox" } as const;

export async function loadSettings(): Promise<Settings | null> {
  return (await get<Settings>(K.settings)) ?? null;
}
export async function saveSettings(s: Settings): Promise<void> {
  await set(K.settings, s);
}

export async function loadAttempts(): Promise<Attempt[]> {
  return (await get<Attempt[]>(K.attempts)) ?? [];
}
export async function addAttempts(a: Attempt[]): Promise<Attempt[]> {
  const all = [...(await loadAttempts()), ...a].slice(-500);
  await set(K.attempts, all);
  return all;
}

export async function loadOutbox(): Promise<OutboxItem[]> {
  return (await get<OutboxItem[]>(K.outbox)) ?? [];
}
export async function saveOutbox(items: OutboxItem[]): Promise<void> {
  await set(K.outbox, items.slice(-50));
}

export type SyncState = "sent" | "unavailable" | "offline" | "idle";

/** Sends queued reasoning to /api/explain. Anything that is not a 200 stays queued. */
export async function syncOutbox(): Promise<OutboxItem[]> {
  return (await syncOutboxReport()).items;
}

export async function syncOutboxReport(): Promise<{ items: OutboxItem[]; state: SyncState }> {
  const items = await loadOutbox();
  if (!items.some((i) => i.status === "queued")) return { items, state: "idle" };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { items, state: "offline" };
  let changed = false;
  let failed = false;
  for (const it of items) {
    if (it.status !== "queued") continue;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: it.lang, templateId: it.templateId, seed: it.seed, answer: it.answer, reasoning: it.reasoning }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        failed = true;
        continue;
      }
      const data: unknown = await res.json();
      if (isResult(data)) {
        it.status = "done";
        it.result = data;
        changed = true;
      }
    } catch {
      failed = true; // stays queued
    }
  }
  if (changed) await saveOutbox(items);
  return { items, state: failed ? "unavailable" : "sent" };
}

function isResult(x: unknown): x is NonNullable<OutboxItem["result"]> {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.feedback === "string" &&
    typeof r.question === "string" &&
    (r.stage === "formulate" || r.stage === "employ" || r.stage === "interpret")
  );
}
