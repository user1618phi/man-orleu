import type { ErrorType } from "./types";

export interface GenChoice {
  text: string;
  correct: boolean;
  why: string;
}
export interface GeneratedTask {
  id: string;
  lang: "kk" | "ru";
  context: string;
  title: string;
  situation: string;
  data: { id: string; label: string; value: number; unit: string; needed: boolean }[];
  formulate: { prompt: string; choices: GenChoice[] };
  employ: { prompt: string; unit: string; answer: number; bugs: { value: number; errorType: ErrorType; why: string }[]; hints: string[] };
  interpret: { prompt: string; choices: GenChoice[] };
  ts: number;
}
