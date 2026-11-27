export type Lang = "kk" | "ru";
export type Stage = "formulate" | "employ" | "interpret";
export type ErrorType =
  | "wrong_data" // took the wrong row or number
  | "ignored_condition" // missed a condition or footnote
  | "unit_error" // did not convert units
  | "wrong_operation" // wrong operation
  | "partial_solution" // stopped at an intermediate step
  | "calc_slip" // arithmetic: no bug path matched
  | "no_interpretation"; // computed but did not answer the question

export const STAGES: Stage[] = ["formulate", "employ", "interpret"];
export const ERROR_TYPES: ErrorType[] = [
  "wrong_data",
  "ignored_condition",
  "unit_error",
  "wrong_operation",
  "partial_solution",
  "calc_slip",
  "no_interpretation",
];

export type L = Record<Lang, string>;
export type Params = Record<string, number>;
export type Level = 1 | 2 | 3;

/** needed: data the solution requires; trap: data that must not be used. */
export interface Cell {
  id: string;
  text: (p: Params) => L;
  needed: boolean;
  trap?: boolean;
}

export type Stimulus =
  | { kind: "table"; caption: L; head: L[]; rows: Cell[][]; footnote?: Cell }
  | { kind: "receipt"; title: L; lines: { label: L; value: Cell }[]; footnote?: Cell }
  | { kind: "card"; title: L; facts: { label: L; value: Cell }[] };

export interface Choice {
  text: L;
  correct: boolean;
  errorType?: ErrorType;
  why: L;
}

export interface Bug {
  value: (p: Params) => number;
  errorType: ErrorType;
  why: L;
}

export interface TaskTemplate {
  id: string;
  title: L;
  context: "transport" | "shop" | "tariff" | "recipe" | "credit" | "medicine" | "farm" | "utilities" | "map" | "chart";
  /** Numbers are chosen so the answer is "nice"; must be deterministic for a given rng. */
  params: (rng: () => number, level: Level) => Params;
  /** 2–3 sentences, never depends on params (Kazakh case endings depend on numerals). */
  situation: L;
  stimulus: (p: Params) => Stimulus[];
  formulate: { prompt: L; choices: Choice[]; dataHint: L };
  employ: {
    prompt: L;
    unit: L;
    answer: (p: Params) => number;
    tolerance?: number;
    bugs: Bug[];
    hints: [L, L];
  };
  interpret: { prompt: L; choices: (p: Params) => Choice[] };
}

export interface Attempt {
  templateId: string;
  seed: number;
  stage: Stage;
  correct: boolean;
  errorType?: ErrorType;
  ts: number;
}

export interface OutboxItem {
  id: string;
  templateId: string;
  seed: number;
  lang: Lang;
  answer: number;
  reasoning: string;
  ts: number;
  status: "queued" | "done" | "failed";
  result?: { stage: Stage; feedback: string; question: string };
}
