"use client";

import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { useOnline } from "./NetBadge";
import { num } from "@/lib/format";
import { ERROR_NAME } from "@/lib/i18n";
import type { GeneratedTask } from "@/lib/generated";
import type { Lang } from "@/lib/types";

const KEY = "man:generated";

const TX = {
  title: { kk: "Жергілікті жағдайдан есеп", ru: "Задача из местного контекста" },
  help: {
    kk: "Ауылдағы жағдайды сипаттаңыз — ЖИ одан үш қадамды есеп пен қате жолдарының картасын жасайды. Сервер арифметиканы қайта тексереді.",
    ru: "Опишите местную ситуацию — ИИ сделает из неё задачу в три шага с картой ошибок. Сервер перепроверяет арифметику.",
  },
  ph: { kk: "мысалы: аудан орталығына автобус, біздің дүкендегі баға…", ru: "например: автобус до райцентра, цены в нашем магазине…" },
  make: { kk: "Есеп жасау", ru: "Сделать задачу" },
  busy: { kk: "жасалуда…", ru: "готовим…" },
  offline: { kk: "Желі керек — бұл мұғалімге арналған онлайн функция.", ru: "Нужна сеть — это онлайн-функция для учителя." },
  fail: { kk: "ЖИ қолжетімсіз немесе есеп тексеруден өтпеді. Кейінірек көріңіз.", ru: "ИИ недоступен или задача не прошла проверку. Попробуйте позже." },
  answer: { kk: "жауап", ru: "ответ" },
  bugs: { kk: "қате жолдар", ru: "ошибочные пути" },
  saved: { kk: "сақталған есептер", ru: "сохранённые задачи" },
  check: { kk: "ЖИ жазды — сабаққа дейін тексеріңіз.", ru: "Написано ИИ — проверьте перед уроком." },
} as const;

export function LocalTask({ lang }: { lang: Lang }) {
  const online = useOnline();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void get<GeneratedTask[]>(KEY).then((t) => setTasks(t ?? []));
  }, []);

  const make = async () => {
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, context: text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const t = (await res.json()) as GeneratedTask;
      const next = [t, ...tasks].slice(0, 30);
      setTasks(next);
      await set(KEY, next);
      setOpen(t.id);
      setText("");
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-8">
      <h2 className="text-[26px]">{TX.title[lang]}</h2>
      <p className="text-[15px] text-mut">{TX.help[lang]}</p>
      <textarea className="field min-h-[96px]" maxLength={1000} value={text} placeholder={TX.ph[lang]} onChange={(e) => setText(e.target.value)} />
      {!online && <p className="mark warn">{TX.offline[lang]}</p>}
      {err && <p className="mark bad whitespace-normal">{TX.fail[lang]}</p>}
      <button type="button" className="btn self-start" disabled={!online || busy || text.trim().length < 10} onClick={make}>
        {busy ? TX.busy[lang] : TX.make[lang]}
      </button>

      {tasks.length > 0 && (
        <div className="mt-4 flex flex-col">
          <p className="label mb-2">{TX.saved[lang]}</p>
          {tasks.map((t) => (
            <div key={t.id} className="border-b border-line py-3 first:border-t">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
                <span className="text-[17px]">{t.title}</span>
                <span className="label">{open === t.id ? "−" : "+"}</span>
              </button>
              {open === t.id && (
                <div className="mt-3 flex flex-col gap-3 text-[15px]">
                  <p>{t.situation}</p>
                  <div>
                    {t.data.map((d) => (
                      <div key={d.id} className="flex justify-between gap-3 border-b border-line py-1">
                        <span className="text-mut">{d.label}</span>
                        <span className="num">
                          {num(d.value)} {d.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p>
                    <span className="label">1 · </span>
                    {t.formulate.prompt}
                  </p>
                  <p>
                    <span className="label">2 · </span>
                    {t.employ.prompt} <span className="mark ok">{TX.answer[lang]}: {num(t.employ.answer)} {t.employ.unit}</span>
                  </p>
                  <div className="flex flex-col gap-1 pl-4">
                    <span className="label">{TX.bugs[lang]}</span>
                    {t.employ.bugs.map((b, i) => (
                      <span key={i}>
                        <span className="num">{num(b.value)}</span> — {ERROR_NAME[b.errorType][lang]}: {b.why}
                      </span>
                    ))}
                  </div>
                  <p>
                    <span className="label">3 · </span>
                    {t.interpret.prompt}
                  </p>
                  <p className="mark info whitespace-normal">{TX.check[lang]}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
