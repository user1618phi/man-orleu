import { mulberry32 } from "./rng";
import type { Cell, Choice, ErrorType, L, Level, Params, Stimulus, TaskTemplate } from "./types";
import { TEMPLATES } from "./templates";

export function levelOf(seed: number): Level {
  return (((seed >>> 0) % 3) + 1) as Level;
}

/** A seed whose level is `level`; level is encoded in the seed so (templateId, seed) is enough. */
export function seedFor(level: Level, rnd: () => number = Math.random): number {
  const base = Math.floor(rnd() * 1_000_000) * 3;
  return base + (level - 1);
}

export interface Instance {
  template: TaskTemplate;
  seed: number;
  level: Level;
  params: Params;
  stimulus: Stimulus[];
}

export function getTemplate(id: string): TaskTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function instantiate(t: TaskTemplate, seed: number): Instance {
  const level = levelOf(seed);
  const params = t.params(mulberry32(seed), level);
  return { template: t, seed, level, params, stimulus: t.stimulus(params) };
}

export function allCells(stimulus: Stimulus[]): Cell[] {
  const out: Cell[] = [];
  for (const s of stimulus) {
    if (s.kind === "table") s.rows.forEach((r) => out.push(...r));
    if (s.kind === "receipt") s.lines.forEach((l) => out.push(l.value));
    if (s.kind === "card") s.facts.forEach((f) => out.push(f.value));
    if (s.kind !== "card" && s.footnote) out.push(s.footnote);
  }
  return out;
}

export interface Verdict {
  correct: boolean;
  errorType?: ErrorType;
  missed?: string[];
  extra?: string[];
  choiceWhy?: Choice["why"];
}

export function checkFormulate(inst: Instance, choiceIndex: number, picked: Set<string>): Verdict {
  const choice = inst.template.formulate.choices[choiceIndex];
  const cells = allCells(inst.stimulus);
  const missed = cells.filter((c) => c.needed && !picked.has(c.id)).map((c) => c.id);
  const extra = cells.filter((c) => c.trap && picked.has(c.id)).map((c) => c.id);
  if (!choice.correct) return { correct: false, errorType: choice.errorType ?? "no_interpretation", missed, extra, choiceWhy: choice.why };
  if (extra.length) return { correct: false, errorType: "wrong_data", missed, extra };
  if (missed.length) return { correct: false, errorType: "ignored_condition", missed, extra };
  return { correct: true, missed, extra };
}

export interface EmployVerdict {
  correct: boolean;
  errorType?: ErrorType;
  bugIndex?: number;
}

export function checkEmploy(inst: Instance, value: number): EmployVerdict {
  const e = inst.template.employ;
  const tol = e.tolerance ?? 0.01;
  if (Math.abs(value - e.answer(inst.params)) <= tol) return { correct: true };
  for (let i = 0; i < e.bugs.length; i++) {
    if (Math.abs(value - e.bugs[i].value(inst.params)) <= tol) return { correct: false, errorType: e.bugs[i].errorType, bugIndex: i };
  }
  return { correct: false, errorType: "calc_slip" };
}

/** Stable per-instance order of choices, so the correct one is not always first. */
export function choiceOrder(seed: number, n: number, salt: number): number[] {
  const rng = mulberry32((seed ^ salt) >>> 0);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/** A row the student can tap on step 1B: a table row, a receipt line, a card fact or a footnote. */
export interface DataRow {
  id: string;
  cells: Cell[];
  label?: L;
  needed: boolean;
  trap: boolean;
}

export function dataRows(stimulus: Stimulus[]): DataRow[][] {
  return stimulus.map((s) => {
    const rows: DataRow[] = [];
    const mk = (cells: Cell[], label?: L): DataRow => ({ id: cells[0].id, cells, label, needed: cells.some((c) => c.needed), trap: cells.some((c) => !!c.trap) });
    if (s.kind === "table") s.rows.forEach((r) => rows.push(mk(r)));
    if (s.kind === "receipt") s.lines.forEach((l) => rows.push(mk([l.value], l.label)));
    if (s.kind === "card") s.facts.forEach((f) => rows.push(mk([f.value], f.label)));
    if (s.kind !== "card" && s.footnote) rows.push(mk([s.footnote]));
    return rows;
  });
}

export interface DataVerdict {
  correct: boolean;
  errorType?: ErrorType;
  extra: DataRow[];
  missing: number;
}

/** Wrong if a trap row is picked or a needed row is missing; other extra rows are harmless. */
export function checkData(inst: Instance, picked: Set<string>): DataVerdict {
  const rows = dataRows(inst.stimulus).flat();
  const extra = rows.filter((r) => r.trap && picked.has(r.id));
  const missing = rows.filter((r) => r.needed && !picked.has(r.id)).length;
  if (extra.length) return { correct: false, errorType: "wrong_data", extra, missing };
  if (missing) return { correct: false, errorType: "ignored_condition", extra, missing };
  return { correct: true, extra, missing };
}
