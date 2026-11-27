"use client";

import type { Cell, Lang, Params, Stimulus } from "@/lib/types";

interface Props {
  stimulus: Stimulus[];
  params: Params;
  lang: Lang;
  /** When set, cells can be tapped to mark them. */
  picked?: Set<string>;
  onToggle?: (id: string) => void;
  /** After the check: highlight needed cells and wrongly picked traps. */
  reveal?: boolean;
}

export function StimulusView({ stimulus, params, lang, picked, onToggle, reveal }: Props) {
  const cellState = (c: Cell) => {
    const on = picked?.has(c.id) ?? false;
    let cls = "";
    if (reveal && c.needed && !on) cls = "outline outline-1 -outline-offset-1 outline-dashed outline-acc";
    if (reveal && c.trap && on) cls = "outline outline-1 -outline-offset-1 outline-bad";
    return { on, cls };
  };

  const CellView = ({ c, big }: { c: Cell; big?: boolean }) => {
    const { on, cls } = cellState(c);
    const text = c.text(params)[lang];
    const base = `${big ? "num text-[19px]" : "text-[15px]"} leading-snug rounded-[10px] px-2 py-2 -mx-1 ${cls}`;
    if (!onToggle) return <span className={`block ${base}`}>{text}</span>;
    return (
      <button type="button" aria-pressed={on} onClick={() => onToggle(c.id)} className={`cell-pick block w-full text-left ${base}`}>
        {text}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {stimulus.map((s, i) => {
        if (s.kind === "table")
          return (
            <figure key={i} className="m-0">
              <figcaption className="label mb-2">{s.caption[lang]}</figcaption>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {s.head.map((h, j) => (
                      <th key={j} className="label border-b border-line py-2 pr-2 text-left font-normal">
                        {h[lang]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c) => (
                        <td key={c.id} className="border-b border-line py-1 pr-2 align-middle">
                          <CellView c={c} big={/^[\d\s\u00a0:,.%₸−-]+(мин|ай|мес|ГБ|МБ|кг|л)?$/.test(c.text(params)[lang].trim())} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.footnote && (
                <div className="mt-2 flex items-start gap-2">
                  <span className="label pt-2">*</span>
                  <CellView c={s.footnote} />
                </div>
              )}
            </figure>
          );
        const rows = s.kind === "receipt" ? s.lines : s.facts;
        return (
          <figure key={i} className={`m-0 ${s.kind === "receipt" ? "border-y border-dashed border-line py-3" : ""}`}>
            <figcaption className="label mb-2">{s.title[lang]}</figcaption>
            <div>
              {rows.map((row) => (
                <div key={row.value.id} className="flex items-center justify-between gap-3 border-b border-line py-1 last:border-b-0">
                  <span className="text-[15px] text-mut">{row.label[lang]}</span>
                  <span className="max-w-[60%] text-right">
                    <CellView c={row.value} big />
                  </span>
                </div>
              ))}
            </div>
            {s.kind === "receipt" && s.footnote && (
              <div className="mt-2 flex items-start gap-2">
                <span className="label pt-2">*</span>
                <CellView c={s.footnote} />
              </div>
            )}
          </figure>
        );
      })}
    </div>
  );
}
