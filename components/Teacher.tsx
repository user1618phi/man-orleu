"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import jsQR from "jsqr";
import { NetBadge } from "./NetBadge";
import { decodeSummary, pct, type Summary } from "@/lib/profile";
import { demoClass, ERROR_TIP, STAGE_TIP } from "@/lib/teacher";
import { ERROR_NAME, STAGE_NAME } from "@/lib/i18n";
import { loadSettings } from "@/lib/store";
import { ERROR_TYPES, STAGES, type ErrorType, type Lang, type Stage } from "@/lib/types";

const KEY = "man:class";

const TT = {
  title: { kk: "Сынып\nқай қадамда қиналады", ru: "На каком шаге\nтеряется класс" },
  demo: { kk: "Демо-сыныпты жүктеу", ru: "Загрузить демо-класс" },
  scan: { kk: "QR сканерлеу", ru: "Сканировать QR" },
  stop: { kk: "Тоқтату", ru: "Остановить" },
  code: { kk: "оқушы коды", ru: "код ученика" },
  add: { kk: "Қосу", ru: "Добавить" },
  bad: { kk: "Код қате — қайта тексеріңіз", ru: "Код не распознан — проверьте" },
  added: { kk: "қосылды", ru: "добавлен" },
  clear: { kk: "Тізімді тазалау", ru: "Очистить список" },
  empty: { kk: "Әзірге оқушы жоқ. Оқушылар экрандағы QR-ды көрсетеді — интернет керек емес. Немесе демо-сыныпты жүктеңіз.", ru: "Пока нет учеников. Ученики показывают QR с экрана — интернет не нужен. Или загрузите демо-класс." },
  students: { kk: "оқушы", ru: "учеников" },
  answers: { kk: "жауап", ru: "ответов" },
  errors: { kk: "жиі қателер", ru: "типичные ошибки" },
  lesson: { kk: "ертеңгі сабаққа", ru: "приём на завтрашний урок" },
  list: { kk: "оқушылар", ru: "ученики" },
  noCam: { kk: "Камера қолжетімсіз — кодты қолмен енгізіңіз.", ru: "Камера недоступна — введите код вручную." },
  toStudent: { kk: "оқушы режимі", ru: "режим ученика" },
  note: { kk: "Деректер тек осы құрылғыда сақталады. Сервер мен аккаунт жоқ.", ru: "Данные хранятся только на этом устройстве. Ни сервера, ни аккаунтов." },
} as const;

export function Teacher() {
  const [lang, setLang] = useState<Lang>("kk");
  const [list, setList] = useState<Summary[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      if (s) setLang(s.lang);
      setList((await get<Summary[]>(KEY)) ?? []);
    })();
  }, []);

  const save = (l: Summary[]) => {
    setList(l);
    void set(KEY, l);
  };

  const addCode = (raw: string): boolean => {
    const s = decodeSummary(raw);
    if (!s) {
      setMsg({ ok: false, text: TT.bad[lang] });
      return false;
    }
    const next = [...list.filter((x) => x.name !== s.name), s];
    save(next);
    setMsg({ ok: true, text: `${s.name} — ${TT.added[lang]}` });
    setCode("");
    return true;
  };

  const agg = useMemo(() => {
    const stages = Object.fromEntries(STAGES.map((s) => [s, { ok: 0, total: 0 }])) as Summary["stages"];
    const errors = Object.fromEntries(ERROR_TYPES.map((e) => [e, 0])) as Record<ErrorType, number>;
    for (const st of list) {
      for (const s of STAGES) {
        stages[s].ok += st.stages[s].ok;
        stages[s].total += st.stages[s].total;
      }
      for (const e of ERROR_TYPES) errors[e] += st.errors[e];
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
    const topErrors = ERROR_TYPES.map((e) => [e, errors[e]] as const)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    const totalAnswers = STAGES.reduce((n, s) => n + stages[s].total, 0);
    return { stages, weak, topErrors, totalAnswers };
  }, [list]);

  const maxErr = agg.topErrors[0]?.[1] ?? 1;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-4">
      <div className="panel sticky top-2 z-10 mb-8 flex items-center justify-between gap-3 px-4 py-3">
        <span className="font-mono text-[20px] tracking-tight">мән · {lang === "kk" ? "мұғалім" : "учитель"}</span>
        <NetBadge lang={lang} queued={0} />
        <button type="button" className="btn !min-h-[36px] !px-3 !py-1 font-mono !text-[13px]" onClick={() => setLang(lang === "kk" ? "ru" : "kk")}>
          {lang === "kk" ? "рус" : "қаз"}
        </button>
      </div>

      <main className="flex flex-col gap-12 pb-16">
        <h1 className="enter whitespace-pre-line text-[40px]">
          {TT.title[lang].split("\n")[0]}
          {"\n"}
          <span className="text-acc-text">{TT.title[lang].split("\n")[1]}</span>
        </h1>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn primary" onClick={() => save([...demoClass(), ...list.filter((x) => !demoClass().some((d) => d.name === x.name))])}>
              {TT.demo[lang]}
            </button>
            <button type="button" className="btn" onClick={() => setScanning((v) => !v)}>
              {scanning ? TT.stop[lang] : TT.scan[lang]}
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
          <label className="flex flex-col gap-2">
            <span className="label">{TT.code[lang]}</span>
            <div className="flex gap-2">
              <input className="field num" value={code} placeholder="M1.Айгерім.3-5.4-5.2-5.0-1-0-2-0-1-1.xx" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCode(code)} />
              <button type="button" className="btn" disabled={!code.trim()} onClick={() => addCode(code)}>
                {TT.add[lang]}
              </button>
            </div>
          </label>
          {msg && <p className={`mark ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}
        </section>

        {list.length === 0 ? (
          <p className="text-mut">{TT.empty[lang]}</p>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <p className="label num">
                {lang === "kk"
                  ? `${list.length} ${TT.students.kk} · ${agg.totalAnswers} ${TT.answers.kk}`
                  : `${TT.students.ru}: ${list.length} · ${TT.answers.ru}: ${agg.totalAnswers}`}
              </p>
              <div>
                {STAGES.map((s, i) => {
                  const v = pct(agg.stages[s]);
                  const weak = agg.weak === s;
                  return (
                    <div key={s} className="flex items-center gap-4 border-b border-line py-3 first:border-t">
                      <span className="label num w-4">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-[17px]">{STAGE_NAME[s][lang]}</p>
                        <div className="mt-2 h-[3px] w-full bg-line">
                          <div className={`h-full ${weak ? "bg-acc" : "bg-fg"}`} style={{ width: `${v ?? 0}%` }} />
                        </div>
                      </div>
                      <span className={`num text-[30px] ${weak ? "text-acc-text" : ""}`}>{v === null ? "—" : `${v}%`}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {agg.topErrors.length > 0 && (
              <section className="flex flex-col gap-3">
                <p className="label">{TT.errors[lang]}</p>
                <div>
                  {agg.topErrors.slice(0, 5).map(([e, n]) => (
                    <div key={e} className="flex items-center gap-4 border-b border-line py-2 first:border-t">
                      <span className="flex-1 text-[16px]">{ERROR_NAME[e][lang]}</span>
                      <span className="hidden h-[3px] w-24 bg-line sm:block">
                        <span className="block h-full bg-fg" style={{ width: `${(100 * n) / maxErr}%` }} />
                      </span>
                      <span className="num w-10 text-right text-[18px]">{n}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {agg.weak && (
              <section className="flex flex-col gap-4 border-l-2 border-acc pl-4">
                <p className="label">{TT.lesson[lang]}</p>
                <h2 className="text-[24px]">{STAGE_TIP[agg.weak].title[lang]}</h2>
                <ol className="flex list-none flex-col gap-2 p-0">
                  {STAGE_TIP[agg.weak].steps.map((st, i) => (
                    <li key={i} className="flex gap-3 text-[16px]">
                      <span className="label num pt-0.5">{i + 1}</span>
                      <span>{st[lang]}</span>
                    </li>
                  ))}
                </ol>
                {agg.topErrors[0] && <p className="mark info whitespace-normal">{ERROR_TIP[agg.topErrors[0][0]][lang]}</p>}
              </section>
            )}

            <section className="flex flex-col gap-3">
              <p className="label">{TT.list[lang]}</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[15px]">
                  <thead>
                    <tr>
                      <th className="label border-b border-line py-2 text-left font-normal">—</th>
                      {STAGES.map((s) => (
                        <th key={s} className="label border-b border-line py-2 text-right font-normal">
                          {STAGE_NAME[s][lang].toLowerCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((st) => {
                      const weakest = STAGES.reduce<Stage>((a, s) => ((pct(st.stages[s]) ?? 100) < (pct(st.stages[a]) ?? 100) ? s : a), "employ");
                      return (
                        <tr key={st.name}>
                          <td className="border-b border-line py-2">{st.name}</td>
                          {STAGES.map((s) => {
                            const v = pct(st.stages[s]);
                            return (
                              <td key={s} className={`num border-b border-line py-2 text-right ${s === weakest && (v ?? 100) < 60 ? "text-acc-text" : ""}`}>
                                {v === null ? "—" : `${v}%`}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="link label self-start" onClick={() => save([])}>
                {TT.clear[lang]}
              </button>
            </section>
          </>
        )}

        <footer className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="label">{TT.note[lang]}</p>
          {/* Full navigation on purpose: client-side transitions need RSC requests that fail offline. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="link label self-start" href="/">
            ← {TT.toStudent[lang]}
          </a>
        </footer>
      </main>
    </div>
  );
}

interface DetectorLike {
  detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

function Scanner({ lang, onCode }: { lang: Lang; onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  const cb = useRef(onCode);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
    const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;

    const tick = async () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2) {
        let found: string | null = null;
        if (detector) {
          try {
            const r = await detector.detect(v);
            if (r[0]) found = r[0].rawValue;
          } catch {
            /* fall through to jsQR */
          }
        }
        if (!found && ctx) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const r = jsQR(img.data, img.width, img.height);
          if (r) found = r.data;
        }
        if (found) {
          cb.current(found);
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    (async () => {
      if (!navigator.mediaDevices) throw new Error("no camera");
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    })()
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        raf = requestAnimationFrame(() => void tick());
      })
      .catch(() => setErr(true));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (err) return <p className="mark warn">{TT.noCam[lang]}</p>;
  return <video ref={video} playsInline muted className="aspect-square w-full max-w-[320px] rounded-[18px] border border-line object-cover" />;
}
