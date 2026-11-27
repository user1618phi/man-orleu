import type { Instance } from "./engine";
import { num } from "./format";
import type { Lang } from "./types";

/** Plain-text rendering of a task instance for the model. */
export function instanceText(inst: Instance, lang: Lang): string {
  const t = inst.template;
  const p = inst.params;
  const out: string[] = [`# ${t.title[lang]}`, t.situation[lang], ""];
  for (const s of inst.stimulus) {
    if (s.kind === "table") {
      out.push(`## ${s.caption[lang]}`, s.head.map((h) => h[lang]).join(" | "));
      for (const r of s.rows) out.push(r.map((c) => c.text(p)[lang]).join(" | "));
      if (s.footnote) out.push(`* ${s.footnote.text(p)[lang]}`);
    } else {
      const rows = s.kind === "receipt" ? s.lines : s.facts;
      out.push(`## ${s.title[lang]}`);
      for (const r of rows) out.push(`${r.label[lang]}: ${r.value.text(p)[lang]}`);
      if (s.kind === "receipt" && s.footnote) out.push(`* ${s.footnote.text(p)[lang]}`);
    }
    out.push("");
  }
  out.push(`Step 1 (formulate): ${t.formulate.prompt[lang]}`);
  out.push(`Step 2 (employ): ${t.employ.prompt[lang]} [${t.employ.unit[lang]}]`);
  out.push(`Step 3 (interpret): ${t.interpret.prompt[lang]}`);
  return out.join("\n");
}

/** Forms of a number that would count as revealing it. */
export function numberForms(n: number): string[] {
  const r = Math.round(n * 100) / 100;
  const plain = String(r);
  return [...new Set([plain, plain.replace(".", ","), num(r).replace(/ /g, " "), num(r)])].filter((s) => s.replace(/\D/g, "").length >= 2);
}
