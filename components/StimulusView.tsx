"use client";

import { dataRows, type DataRow } from "@/lib/engine";
import type { Lang, Params, Stimulus } from "@/lib/types";
import { IconCheck, IconCross } from "./Icons";

interface Props {
  stimulus: Stimulus[];
  params: Params;
  lang: Lang;
  /** "select": rows are buttons (step 1B). */
  mode?: "view" | "select";
  picked?: Set<string>;
  onToggle?: (id: string) => void;
  /** Rows the student marked earlier; shown softly on later steps. */
  highlight?: Set<string>;
  /** Rows marked wrong after a check. */
  bad?: Set<string>;
}

const isNum = (s: string) => /^[\d\s :,.%₸°C+−-]+(мин|ай|мес|ГБ|МБ|кг|г|мл|л|см|м|°C|чел\.|адам)?$/.test(s.trim());

export function StimulusView({ stimulus, params, lang, mode = "view", picked, onToggle, highlight, bad }: Props) {
  const rowsBy = dataRows(stimulus);
  const select = mode === "select" && !!onToggle;

  const rowProps = (r: DataRow) => {
    const on = picked?.has(r.id) ?? false;
    const isBad = bad?.has(r.id) ?? false;
    const hl = !select && (highlight?.has(r.id) ?? false);
    const bg = isBad ? "bg-bad-soft" : on ? "bg-primary-soft" : hl ? "bg-primary-soft" : "";
    const className = `${bg} ${select ? "cursor-pointer" : ""}`;
    if (!select) return { className };
    return {
      className,
      role: "button",
      tabIndex: 0,
      "aria-pressed": on,
      onClick: () => onToggle?.(r.id),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle?.(r.id);
        }
      },
    };
  };

  const box = (r: DataRow) => {
    if (!select) return null;
    const on = picked?.has(r.id) ?? false;
    const isBad = bad?.has(r.id) ?? false;
    return (
      <span
        aria-hidden
        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border-2 ${isBad ? "border-bad bg-bad text-white" : on ? "border-primary bg-primary text-white" : "border-[#b9b3c2] bg-surface"}`}
      >
        {isBad ? <IconCross size={14} /> : on ? <IconCheck size={14} /> : null}
      </span>
    );
  };

  const val = (text: string, right?: boolean) =>
    isNum(text) ? (
      <span className={`tnum whitespace-nowrap ${select ? "text-[17px]" : "text-[19px]"} font-bold leading-6 ${right ? "text-right" : ""}`}>{text}</span>
    ) : (
      <span className={`text-[17px] leading-6 ${right ? "text-right" : ""}`}>{text}</span>
    );

  const footRow = (r: DataRow, top: boolean) => {
    const rp = rowProps(r);
    return (
      <div {...rp} className={`${rp.className} flex min-h-12 items-center gap-3 px-4 py-3 ${top ? "border-t border-line" : ""}`}>
        {box(r)}
        <span className="text-[15px] leading-5 text-text-2">* {r.cells[0].text(params)[lang]}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {stimulus.map((s, i) => {
        const rows = rowsBy[i];
        if (s.kind === "table") {
          const body = rows.slice(0, s.rows.length);
          const foot = s.footnote ? rows[s.rows.length] : null;
          return (
            <div key={i} className="card overflow-hidden !p-0">
              <p className="px-4 pt-3 text-[17px] font-bold">{s.caption[lang]}</p>
              <table className="mt-1 w-full border-collapse">
                <thead>
                  <tr>
                    {select && <th className="w-9" aria-hidden />}
                    {s.head.map((h, j) => (
                      <th key={j} className={`t-2 border-b border-line py-2 text-left font-normal [overflow-wrap:anywhere] ${select ? "px-1" : "px-2"} ${j === 0 && !select ? "pl-4" : ""}`}>
                        {h[lang]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r) => (
                    <tr key={r.id} {...rowProps(r)}>
                      {select && <td className="border-b border-line py-3 pl-3 pr-1 align-middle">{box(r)}</td>}
                      {r.cells.map((c, j) => (
                        <td key={c.id} className={`h-12 border-b border-line py-2 align-middle ${select ? "px-1" : "px-2"} ${j === 0 && !select ? "pl-4" : ""}`}>
                          {val(c.text(params)[lang])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {foot && footRow(foot, false)}
            </div>
          );
        }
        const main = s.kind === "receipt" ? rows.slice(0, s.lines.length) : rows;
        const foot = s.kind === "receipt" && s.footnote ? rows[s.lines.length] : null;
        return (
          <div key={i} className={`card overflow-hidden !p-0 ${s.kind === "receipt" ? "border-dashed" : ""}`}>
            <p className="px-4 pt-3 text-[17px] font-bold">{s.title[lang]}</p>
            <div className="mt-2">
              {main.map((r) => {
                const rp = rowProps(r);
                return (
                  <div key={r.id} {...rp} className={`${rp.className} flex min-h-12 items-center gap-3 border-t border-line px-4 py-2`}>
                    {box(r)}
                    <span className="flex-1 text-[17px] leading-6 text-text-2">{r.label?.[lang]}</span>
                    {val(r.cells[0].text(params)[lang], true)}
                  </div>
                );
              })}
              {foot && footRow(foot, true)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
