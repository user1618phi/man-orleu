"use client";

import { useMemo, useState } from "react";
import { StimulusView } from "./StimulusView";
import { choiceOrder, instantiate } from "@/lib/engine";
import { TEMPLATES } from "@/lib/templates";
import { ERROR_NAME } from "@/lib/i18n";
import { num } from "@/lib/format";
import type { Lang } from "@/lib/types";

const LETTERS = ["А", "Б", "В", "Г"];

/** Paper mode: every student gets the same task with their own numbers; the teacher gets a key with bug paths. */
export function PrintSheets({ lang, onClose, count, names }: { lang: Lang; onClose: () => void; count: number; names: string[] }) {
  const [tpl, setTpl] = useState(TEMPLATES[0].id);
  const [n, setN] = useState(Math.min(40, Math.max(count, 25)));
  const t = TEMPLATES.find((x) => x.id === tpl) ?? TEMPLATES[0];
  const insts = useMemo(() => Array.from({ length: n }, (_, i) => instantiate(t, 200_000 + i * 3 + 1)), [t, n]);
  const ru = lang === "ru";

  return (
    <div className="mx-auto max-w-[800px] px-4 pb-12 pt-4">
      <div className="no-print flex flex-col gap-3">
        <button type="button" className="btn-link self-start no-underline" onClick={onClose}>
          ← {ru ? "Назад" : "Артқа"}
        </button>
        <h1 className="h-screen-title">{ru ? "Варианты на бумаге" : "Қағаздағы нұсқалар"}</h1>
        <p className="text-[17px] leading-6 text-text-2">
          {ru
            ? "Одна задача — у каждого ученика свои числа, списать нельзя. В конце — ключ: верный ответ и числа, которые получаются при типичных ошибках."
            : "Бір есеп — әр оқушыда өз сандары, көшіру мүмкін емес. Соңында — кілт: дұрыс жауап және типтік қателерде шығатын сандар."}
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">{ru ? "Задача" : "Есеп"}</span>
          <select className="field-text" value={tpl} onChange={(e) => setTpl(e.target.value)}>
            {TEMPLATES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title[lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">{ru ? "Сколько вариантов" : "Нұсқа саны"}</span>
          <input className="field-text tnum" type="text" inputMode="numeric" value={n} onChange={(e) => setN(Math.max(1, Math.min(40, Number(e.target.value.replace(/\D/g, "")) || 1)))} />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          {ru ? "Печать" : "Басып шығару"}
        </button>
      </div>

      {insts.map((inst, i) => {
        const o1 = choiceOrder(inst.seed, t.formulate.choices.length, 0x51ed);
        const c3 = t.interpret.choices(inst.params);
        const o3 = choiceOrder(inst.seed, c3.length, 0x7a3c);
        return (
          <section key={inst.seed} className="print-page mt-8 flex flex-col gap-3 border-t-2 border-dashed border-line pt-6">
            <div className="flex justify-between text-[17px]">
              <span className="font-bold">
                {ru ? "Вариант" : "Нұсқа"} {i + 1}
              </span>
              <span>{names[i] ?? (ru ? "Имя: ____________" : "Аты: ____________")}</span>
            </div>
            <h2 className="h-card">{t.title[lang]}</h2>
            <p className="text-[17px] leading-6">{t.situation[lang]}</p>
            <StimulusView stimulus={inst.stimulus} params={inst.params} lang={lang} />
            <p className="font-bold">1. {ru ? "Что нужно найти?" : "Не табу керек?"}</p>
            {o1.map((k, j) => (
              <p key={k} className="pl-4">
                {LETTERS[j]}) {t.formulate.choices[k].text[lang]}
              </p>
            ))}
            <p className="pl-4 text-text-2">{ru ? "Подчеркните в таблице данные, которые нужны." : "Кестеден керек деректердің астын сызыңыз."}</p>
            <p className="font-bold">2. {t.employ.prompt[lang]}</p>
            <p className="pl-4">
              {ru ? "Ответ" : "Жауап"}: ______________ {t.employ.unit[lang]}
            </p>
            <p className="font-bold">3. {t.interpret.prompt[lang]}</p>
            {o3.map((k, j) => (
              <p key={k} className="pl-4">
                {LETTERS[j]}) {c3[k].text[lang]}
              </p>
            ))}
          </section>
        );
      })}

      <section className="print-page mt-8 border-t-2 border-dashed border-line pt-6">
        <h2 className="h-card">{ru ? "Ключ для учителя" : "Мұғалімге кілт"}</h2>
        <p className="t-2 mt-1">{t.title[lang]}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="text-left">
                <th className="border-b border-line py-2 pr-2">№</th>
                <th className="border-b border-line py-2 pr-2">1</th>
                <th className="border-b border-line py-2 pr-2">2</th>
                <th className="border-b border-line py-2 pr-2">3</th>
                <th className="border-b border-line py-2">{ru ? "Если ответ такой — ошибка" : "Жауап осындай болса — қате"}</th>
              </tr>
            </thead>
            <tbody>
              {insts.map((inst, i) => {
                const o1 = choiceOrder(inst.seed, t.formulate.choices.length, 0x51ed);
                const c3 = t.interpret.choices(inst.params);
                const o3 = choiceOrder(inst.seed, c3.length, 0x7a3c);
                const a1 = LETTERS[o1.findIndex((k) => t.formulate.choices[k].correct)];
                const a3 = LETTERS[o3.findIndex((k) => c3[k].correct)];
                return (
                  <tr key={inst.seed} className="align-top">
                    <td className="border-b border-line py-2 pr-2 font-bold">{i + 1}</td>
                    <td className="border-b border-line py-2 pr-2">{a1}</td>
                    <td className="tnum border-b border-line py-2 pr-2 font-bold">{num(t.employ.answer(inst.params))}</td>
                    <td className="border-b border-line py-2 pr-2">{a3}</td>
                    <td className="border-b border-line py-2">
                      {t.employ.bugs.map((b, j) => (
                        <span key={j} className="mr-3 inline-block">
                          <span className="tnum font-semibold">{num(b.value(inst.params))}</span> — {ERROR_NAME[b.errorType][lang].toLowerCase()}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
