import { get, set } from "idb-keyval";
import type { Attempt } from "./types";

export type Form = "A" | "B";
/** Same six tasks in both forms; only the numbers differ (parallel forms). Level 2 seeds: seed % 3 === 1. */
export const EXAM_TEMPLATES = ["bus", "shop", "internet", "credit", "medicine", "power"] as const;
export const examSeed = (form: Form, i: number) => (form === "A" ? 10_000 : 50_000) + i * 3 + 1;
export const EXAM_MAX = EXAM_TEMPLATES.length * 3;

export type ExamScores = Partial<Record<Form, number>>;
const KEY = "man:exam";

export async function loadExam(): Promise<ExamScores> {
  return (await get<ExamScores>(KEY)) ?? {};
}
export async function saveExam(form: Form, attempts: Attempt[]): Promise<ExamScores> {
  const cur = await loadExam();
  const next = { ...cur, [form]: attempts.filter((a) => a.correct).length };
  await set(KEY, next);
  return next;
}
