const NBSP = " ";

export function num(n: number, digits = 2): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  const [i, f] = Math.abs(r).toString().split(".");
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return (r < 0 ? "−" : "") + grouped + (f ? "," + f : "");
}
export const money = (n: number) => `${num(n)}${NBSP}₸`;
export function time(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function same(s: string) {
  return { kk: s, ru: s };
}
export function parseAnswer(s: string): number | null {
  const t = s.replace(/\s| /g, "").replace(",", ".").replace("−", "-");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
