"use client";

import { useEffect, useMemo, useState } from "react";
import { get, set } from "idb-keyval";
import { LocalTask } from "./LocalTask";
import { Scanner } from "./Scanner";
import { PrintSheets } from "./PrintSheets";
import { Badge, IconBang, IconBulb } from "./Icons";
import { decodeSummary, pct, type Summary } from "@/lib/profile";
import { DEMO_NAMES, demoClass, ERROR_TIP, STAGE_TIP } from "@/lib/teacher";
import { ERROR_NAME, STAGE_NAME, levelWord } from "@/lib/i18n";
import { EXAM_MAX } from "@/lib/exam";
import { loadSettings } from "@/lib/store";
import { ERROR_TYPES, STAGES, type ErrorType, type L, type Lang, type Stage } from "@/lib/types";

const KEY = "man:class";

const TT = {
  title: { kk: "Мұғалім панелі", ru: "Панель учителя" },
  toStudent: { kk: "Оқушыға", ru: "Ученику" },
  demo: { kk: "Демо-сыныпты жүктеу", ru: "Загрузить демо-класс" },
  scan: { kk: "QR сканерлеу", ru: "Сканировать QR" },
  stopScan: { kk: "Сканерді жабу", ru: "Закрыть сканер" },
  enterCode: { kk: "Кодты енгізу", ru: "Ввести код" },
  code: { kk: "Оқушы коды", ru: "Код ученика" },
  add: { kk: "Қосу", ru: "Добавить" },
  bad: { kk: "Код танылмады — тексеріңіз", ru: "Код не распознан — проверьте" },
  added: { kk: "қосылды", ru: "добавлен" },
  emptyHint: { kk: "Немесе оқушы телефонындағы QR-ды сканерлеңіз — интернет керек емес.", ru: "Или отсканируйте QR с телефона ученика — интернет не нужен." },
  sinks: { kk: "Құлдырап тұр", ru: "Проседает" },
  topError: { kk: "Сыныптың басты қатесі", ru: "Главная ошибка класса" },
  ofStudents: { kk: "оқушының", ru: "из" },
  tomorrow: { kk: "Ертең сабақта не істеу керек", ru: "Что сделать завтра на уроке" },
  whoHelp: { kk: "Кімге көмектесу керек", ru: "Кому помочь" },
  students: { kk: "Оқушылар", ru: "Ученики" },
  clear: { kk: "Тізімді тазалау", ru: "Очистить список" },
  note: { kk: "Деректер тек осы құрылғыда сақталады. Сервер мен аккаунт жоқ.", ru: "Данные хранятся только на этом устройстве. Ни сервера, ни аккаунтов." },
  demoNote: { kk: "Демо-сынып: ойдан шығарылған деректер, пилот нәтижесі емес.", ru: "Демо-класс: вымышленные данные, не результат пилота." },
  print: { kk: "Сыныпқа нұсқаларды басып шығару", ru: "Напечатать варианты для класса" },
  clearQ: { kk: "Оқушылар тізімін тазалау керек пе?", ru: "Очистить список учеников?" },
  clearSub: { kk: "Осы құрылғыдағы барлық оқушы нәтижесі өшеді.", ru: "Результаты всех учеников на этом устройстве будут удалены." },
  cancel: { kk: "Болдырмау", ru: "Отмена" },
  clearYes: { kk: "Тазалау", ru: "Очистить" },
} satisfies Record<string, L>;

export function Teacher() {
  const [lang, setLang] = useState<Lang>("kk");
  const [list, setList] = useState<Summary[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: true; name: string } | { ok: false } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [printing, setPrinting] = useState(false);
  const L = (l: L) => l[lang];

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      if (s) setLang(s.lang);
      setList((await get<Summary[]>(KEY)) ?? []);
    })();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const save = (l: Summary[]) => {
    setList(l);
    void set(KEY, l);
  };

  const addCode = (raw: string): boolean => {
    const s = decodeSummary(raw);
    if (!s) {
      setMsg({ ok: false });
      return false;
    }
    save([...list.filter((x) => x.name !== s.name), s]);
    setMsg({ ok: true, name: s.name });
    setCode("");
    return true;
  };

  const loadDemo = () => {
    setMsg(null);
    const demo = demoClass();
    save([...demo, ...list.filter((x) => !demo.some((d) => d.name === x.name))]);
  };

  const agg = useMemo(() => {
    const stages = Object.fromEntries(STAGES.map((s) => [s, { ok: 0, total: 0 }])) as Summary["stages"];
    const studentsWith = Object.fromEntries(ERROR_TYPES.map((e) => [e, 0])) as Record<ErrorType, number>;
    const totals = Object.fromEntries(ERROR_TYPES.map((e) => [e, 0])) as Record<ErrorType, number>;
    for (const st of list) {
      for (const s of STAGES) {
        stages[s].ok += st.stages[s].ok;
        stages[s].total += st.stages[s].total;
      }
      for (const e of ERROR_TYPES) {
        totals[e] += st.errors[e];
        if (st.errors[e] > 0) studentsWith[e]++;
      }
    }
    let weak: Stage | null = null;
    let low = 101;
    for (const s of STAGES) {
      const v = pct(stages[s]);
      if (v !== null && v < low) {
        low = v;
        weak = s;
      }
    }
    // Most frequent mistake by count; shown with how many students made it (at least 3 to call it typical).
    const topType = ERROR_TYPES.filter((e) => e !== "calc_slip").sort((a, b) => totals[b] - totals[a])[0];
    const top = topType ? ([topType, studentsWith[topType]] as const) : undefined;
    const topError = top && top[1] >= 3 ? top : null;
    const help = weak
      ? [...list]
          .filter((x) => x.stages[weak!].total > 0)
          .sort((a, b) => (pct(a.stages[weak!]) ?? 100) - (pct(b.stages[weak!]) ?? 100))
          .slice(0, 4)
      : [];
    const both = list.filter((x) => x.exam?.A !== undefined && x.exam?.B !== undefined);
    const avg = (f: "A" | "B") => (both.length ? Math.round((100 * both.reduce((n, x) => n + (x.exam?.[f] ?? 0), 0)) / (both.length * EXAM_MAX)) : null);
    const totalAnswers = STAGES.reduce((n, s) => n + stages[s].total, 0);
    return { stages, weak, topError, help, exam: { n: both.length, before: avg("A"), after: avg("B") }, totalAnswers };
  }, [list]);

  const isDemo = list.some((x) => DEMO_NAMES.includes(x.name));

  if (printing) return <PrintSheets lang={lang} onClose={() => setPrinting(false)} count={Math.max(list.length, 1)} names={list.map((x) => x.name)} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[960px] flex-col gap-4 px-4 pb-12 pt-4">
      <header className="flex items-center gap-3">
        <span className="text-[26px] font-extrabold tracking-tight text-primary">Мән</span>
        <span className="flex-1" />
        {/* Full navigation on purpose: client-side transitions need RSC requests that fail offline. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="inline-flex min-h-12 items-center px-1 text-[15px] font-semibold underline decoration-line underline-offset-4" href="/">
          {L(TT.toStudent)}
        </a>
        <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-line bg-surface p-1">
          {(["kk", "ru"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-10 rounded-[10px] px-3 text-[15px] font-semibold ${lang === l ? "bg-primary text-white" : "text-text-2"}`}
            >
              {l === "kk" ? "Қаз" : "Рус"}
            </button>
          ))}
        </div>
      </header>

      <h1 className="h-screen-title">{L(TT.title)}</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className={`btn ${list.length ? "btn-secondary" : "btn-primary"} sm:!w-auto`} onClick={loadDemo}>
          {L(TT.demo)}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => {
            setMsg(null);
            setScanning((v) => !v);
          }}>
          {scanning ? L(TT.stopScan) : L(TT.scan)}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => {
            setMsg(null);
            setShowCode((v) => !v);
          }}>
          {L(TT.enterCode)}
        </button>
      </div>
      {scanning && (
        <Scanner
          lang={lang}
          onCode={(c) => {
            if (addCode(c)) setScanning(false);
          }}
        />
      )}
      {showCode && (
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">{L(TT.code)}</span>
          <div className="flex gap-2">
            <input className="field-text tnum" value={code} placeholder="M1.Айгерім.…" onChange={(e) => {
                setMsg(null);
                setCode(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && addCode(code)} />
            <button type="button" className="btn btn-primary !w-auto shrink-0" disabled={!code.trim()} onClick={() => addCode(code)}>
              {L(TT.add)}
            </button>
          </div>
        </label>
      )}
      {msg && (
        <p role="status" className={`rounded-[14px] px-4 py-3 text-[17px] font-semibold ${msg.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
          {msg.ok ? `${msg.name} — ${L(TT.added)}` : L(TT.bad)}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-[17px] leading-6 text-text-2">{L(TT.emptyHint)}</p>
      ) : (
        <>
          <p className="text-[17px] font-semibold">
            {lang === "kk" ? `${list.length} оқушы · ${agg.totalAnswers} жауап` : `Учеников: ${list.length} · ответов: ${agg.totalAnswers}`}
          </p>
          {isDemo && <p className="rounded-[14px] bg-mark-soft px-4 py-2 text-[15px] font-semibold">{L(TT.demoNote)}</p>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STAGES.map((s, i) => {
              const v = pct(agg.stages[s]);
              const weak = agg.weak === s;
              return (
                <div key={s} className={`card ${weak ? "!border-2 !border-bad" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Badge tone={weak ? "bad" : "primary"} size={26}>
                      <span className="text-[15px] font-bold">{i + 1}</span>
                    </Badge>
                    <span className="text-[17px] font-semibold">{STAGE_NAME[s][lang]}</span>
                  </div>
                  <p className="tnum mt-2 text-[40px] font-extrabold leading-none">{v === null ? "—" : `${v}%`}</p>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${weak ? "bg-bad" : "bg-primary"}`} style={{ width: `${v ?? 0}%` }} />
                  </div>
                  <p className={`mt-2 text-[15px] font-semibold ${weak ? "text-bad" : "text-text-2"}`}>{weak ? L(TT.sinks) : v !== null ? levelWord(v, lang) : ""}</p>
                </div>
              );
            })}
          </div>

          {agg.topError && (
            <div className="card flex gap-3 border-l-4 !border-l-bad">
              <Badge tone="bad" size={28}>
                <IconBang size={16} />
              </Badge>
              <div>
                <p className="t-2">{L(TT.topError)}</p>
                <p className="text-[20px] font-bold leading-[26px]">{ERROR_NAME[agg.topError[0]][lang]}</p>
                <p className="mt-1 text-[17px]">
                  {lang === "kk" ? `Осы қатені жіберген оқушылар: ${agg.topError[1]} / ${list.length}` : `У ${agg.topError[1]} из ${list.length} учеников`}
                </p>
              </div>
            </div>
          )}

          {agg.weak && (
            <div className="card !border-primary-soft !bg-primary-soft">
              <p className="t-2 !text-text">{L(TT.tomorrow)}</p>
              <p className="h-card mt-1">{STAGE_TIP[agg.weak].title[lang]}</p>
              <ol className="mt-3 flex flex-col gap-2">
                {STAGE_TIP[agg.weak].steps.map((st, i) => (
                  <li key={i} className="flex gap-3 text-[17px] leading-6">
                    <span className="tnum font-extrabold text-primary-text">{i + 1}.</span>
                    <span>{st[lang]}</span>
                  </li>
                ))}
              </ol>
              {agg.topError && (
                <div className="mt-3 flex gap-3 rounded-[12px] bg-surface px-3 py-2">
                  <IconBulb className="mt-0.5 shrink-0" />
                  <p className="text-[17px] leading-6">{ERROR_TIP[agg.topError[0]][lang]}</p>
                </div>
              )}
            </div>
          )}

          {agg.help.length > 0 && agg.weak && (
            <div className="card">
              <p className="t-2">
                {L(TT.whoHelp)} · {STAGE_NAME[agg.weak][lang]}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {agg.help.map((x) => (
                  <span key={x.name} className="rounded-full bg-bad-soft px-3 py-1.5 text-[17px] font-semibold">
                    {x.name} <span className="tnum text-bad">{pct(x.stages[agg.weak!])}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {agg.exam.n > 0 && agg.exam.before !== null && agg.exam.after !== null && (
            <div className="card">
              <p className="t-2">{lang === "kk" ? `Өлшеу: дейін → кейін · ${agg.exam.n} оқушы` : `Замер: до → после · учеников: ${agg.exam.n}`}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="tnum text-[28px] font-extrabold text-text-2">{agg.exam.before}%</span>
                <span className="text-[20px]">→</span>
                <span className="tnum text-[28px] font-extrabold">{agg.exam.after}%</span>
                <span className={`tnum rounded-full px-3 py-1 text-[17px] font-bold ${agg.exam.after >= agg.exam.before ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                  {agg.exam.after >= agg.exam.before ? "+" : ""}
                  {agg.exam.after - agg.exam.before} {lang === "kk" ? "п.т." : "п.п."}
                </span>
              </div>
              <p className="t-2 mt-2">{lang === "kk" ? "Сол алты есеп, басқа сандар — жауапты жаттап алу мүмкін емес." : "Те же шесть задач с другими числами — выучить ответы нельзя."}</p>
            </div>
          )}

          <div className="card overflow-x-auto !p-0">
            <p className="px-4 pt-3 text-[17px] font-bold">{L(TT.students)}</p>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr>
                  <th className="t-2 border-b border-line px-4 py-2 text-left font-normal">{lang === "kk" ? "Аты" : "Имя"}</th>
                  {STAGES.map((s, i) => (
                    <th key={s} className="t-2 border-b border-line px-1 py-2 text-right font-normal sm:px-2">
                      <span className="sm:hidden">{i + 1}</span>
                      <span className="hidden sm:inline">{STAGE_NAME[s][lang]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((st) => (
                  <tr key={st.name}>
                    <td className="h-12 border-b border-line py-2 pl-4 pr-1 text-[17px]">{st.name}</td>
                    {STAGES.map((s) => {
                      const v = pct(st.stages[s]);
                      const tone = v === null ? "" : v < 50 ? "bg-bad-soft text-bad" : v < 80 ? "" : "bg-ok-soft text-ok";
                      return (
                        <td key={s} className="border-b border-line px-1 py-2 text-right sm:px-2">
                          <span className={`tnum inline-block min-w-[46px] rounded-full px-2 py-0.5 text-center text-[17px] font-bold ${tone}`}>{v === null ? "—" : `${v}%`}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn-link self-start" onClick={() => setConfirmClear(true)}>
            {L(TT.clear)}
          </button>
        </>
      )}

      <button type="button" className="btn btn-secondary w-full" onClick={() => setPrinting(true)}>
        {L(TT.print)}
      </button>

      <LocalTask lang={lang} />

      <p className="t-2 mt-4">{L(TT.note)}</p>

      {confirmClear && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/30" onClick={() => setConfirmClear(false)}>
          <div className="sheet-in mx-auto w-full max-w-[480px] rounded-t-[20px] bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-5" onClick={(e) => e.stopPropagation()}>
            <p className="h-card">{L(TT.clearQ)}</p>
            <p className="t-2 mt-1">{L(TT.clearSub)}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setConfirmClear(false)}>
                {L(TT.cancel)}
              </button>
              <button
                type="button"
                className="btn btn-secondary w-full !text-bad"
                onClick={() => {
                  save([]);
                  setMsg(null);
                  setConfirmClear(false);
                }}
              >
                {L(TT.clearYes)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
