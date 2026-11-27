import { ERROR_TYPES, STAGES, type Attempt, type ErrorType, type Stage } from "./types";

export interface Summary {
  name: string;
  stages: Record<Stage, { ok: number; total: number }>;
  errors: Record<ErrorType, number>;
}

export function summarize(name: string, attempts: Attempt[]): Summary {
  const stages = Object.fromEntries(STAGES.map((s) => [s, { ok: 0, total: 0 }])) as Summary["stages"];
  const errors = Object.fromEntries(ERROR_TYPES.map((e) => [e, 0])) as Summary["errors"];
  for (const a of attempts) {
    stages[a.stage].total++;
    if (a.correct) stages[a.stage].ok++;
    else if (a.errorType) errors[a.errorType]++;
  }
  return { name, stages, errors };
}

export function pct(x: { ok: number; total: number }): number | null {
  return x.total ? Math.round((100 * x.ok) / x.total) : null;
}

export function weakest(s: Summary): Stage | null {
  let best: Stage | null = null;
  let low = 101;
  for (const st of STAGES) {
    const v = pct(s.stages[st]);
    if (v !== null && v < low) {
      low = v;
      best = st;
    }
  }
  return low < 70 ? best : null;
}

// QR / manual code: "M1.<name>.<ok-total x3>.<7 error counts>.<checksum>", base36 numbers.
const b36 = (n: number) => Math.max(0, Math.min(1295, n)).toString(36);

function checksum(s: string): string {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1296;
  return h.toString(36).padStart(2, "0");
}

export function encodeSummary(s: Summary): string {
  const name = s.name.replace(/[.\s]+/g, "_").slice(0, 20) || "?";
  const st = STAGES.map((k) => `${b36(s.stages[k].ok)}-${b36(s.stages[k].total)}`).join(".");
  const er = ERROR_TYPES.map((e) => b36(s.errors[e])).join("-");
  const body = `M1.${name}.${st}.${er}`;
  return `${body}.${checksum(body)}`;
}

export function decodeSummary(code: string): Summary | null {
  const parts = code.trim().split(".");
  if (parts.length !== 7 || parts[0] !== "M1") return null;
  const body = parts.slice(0, 6).join(".");
  if (checksum(body) !== parts[6].toLowerCase()) return null;
  const stages = {} as Summary["stages"];
  for (let i = 0; i < 3; i++) {
    const [ok, total] = parts[2 + i].split("-").map((x) => parseInt(x, 36));
    if (!Number.isFinite(ok) || !Number.isFinite(total) || ok > total) return null;
    stages[STAGES[i]] = { ok, total };
  }
  const nums = parts[5].split("-").map((x) => parseInt(x, 36));
  if (nums.length !== ERROR_TYPES.length || nums.some((n) => !Number.isFinite(n))) return null;
  const errors = Object.fromEntries(ERROR_TYPES.map((e, i) => [e, nums[i]])) as Summary["errors"];
  return { name: parts[1].replace(/_/g, " "), stages, errors };
}
