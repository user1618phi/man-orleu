"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Lesson, type LessonResult, type StageStatus } from "./Lesson";
import { useOnline } from "./NetBadge";
import { Badge, IconArrow, IconBang, IconCheck, IconCloud } from "./Icons";
import { instantiate, seedFor, getTemplate, type Instance } from "@/lib/engine";
import { TEMPLATES } from "@/lib/templates";
import { ERROR_NAME, STAGE_NAME, T, levelWord } from "@/lib/i18n";
import { addAttempts, loadAttempts, loadOutbox, loadSettings, saveOutbox, saveSettings, syncOutbox, type Settings } from "@/lib/store";
import { encodeSummary, pct, summarize, weakest } from "@/lib/profile";
import { STAGES, type Attempt, type L, type Lang, type Level, type OutboxItem } from "@/lib/types";
import { EXAM_MAX, EXAM_TEMPLATES, examSeed, loadExam, saveExam, type ExamScores, type Form } from "@/lib/exam";

type Screen = "loading" | "onboard" | "home" | "task" | "result" | "qr" | "outbox" | "exam-intro" | "exam" | "exam-done";

/** Variants checked by `pnpm test`: 200 seeds per template. */
const CHECKED_VARIANTS = TEMPLATES.length * 200;

function useOfflineReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let alive = true;
    const check = async () => {
      try {
        await navigator.serviceWorker.ready;
        const names = await caches.keys();
        for (const n of names) {
          if (!n.startsWith("man-")) continue;
          const keys = await (await caches.open(n)).keys();
          if (keys.length >= 5 && alive) setReady(true);
        }
      } catch {
        /* stays false */
      }
    };
    void check();
    const id = window.setInterval(check, 2000);
    const stop = window.setTimeout(() => window.clearInterval(id), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);
  return ready;
}

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [settings, setSettings] = useState<Settings>({ lang: "kk", name: "", level: 1, streak: 0 });
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [inst, setInst] = useState<Instance | null>(null);
  const [tplIndex, setTplIndex] = useState(0);
  const [last, setLast] = useState<LessonResult | null>(null);
  const [examScores, setExamScores] = useState<ExamScores>({});
  const [exam, setExam] = useState<{ form: Form; index: number; attempts: Attempt[] } | null>(null);
  const [about, setAbout] = useState(false);
  const lang = settings.lang;
  const L = (l: L) => l[lang];

  useEffect(() => {
    (async () => {
      const [s, a, o, ex] = await Promise.all([loadSettings(), loadAttempts(), loadOutbox(), loadExam()]);
      setExamScores(ex);
      setAttempts(a);
      setOutbox(o);
      setTplIndex(Math.floor(Math.random() * TEMPLATES.length));
      if (s) {
        setSettings(s);
        setScreen("home");
      } else setScreen("onboard");
      setOutbox(await syncOutbox());
    })();
    const onOnline = async () => setOutbox(await syncOutbox());
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...patch };
      void saveSettings(n);
      return n;
    });
  }, []);

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo({ top: 0 });
  };

  const startTask = (templateIndex: number) => {
    const i = ((templateIndex % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length;
    setTplIndex(i);
    setInst(instantiate(TEMPLATES[i], seedFor(settings.level)));
    go("task");
  };

  const another = () => {
    if (!inst) return;
    let seed = seedFor(settings.level);
    if (seed === inst.seed) seed += 3;
    setInst(instantiate(inst.template, seed));
    go("task");
  };

  const onDone = async (result: LessonResult) => {
    setAttempts(await addAttempts(result.attempts));
    const ok = (st: string) => result.attempts.find((a) => a.stage === st)?.correct ?? false;
    let { level, streak } = settings;
    if (!ok("formulate")) {
      level = Math.max(1, level - 1) as Level;
      streak = 0;
    } else if (ok("employ") && ok("interpret")) {
      streak += 1;
      if (streak >= 2) {
        level = Math.min(3, level + 1) as Level;
        streak = 0;
      }
    } else streak = 0;
    update({ level, streak });
    setLast(result);
    go("result");
  };

  const enqueue = async (reasoning: string) => {
    if (!inst || !last) return;
    const item: OutboxItem = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      templateId: inst.template.id,
      seed: inst.seed,
      lang,
      answer: last.answer ?? 0,
      reasoning: reasoning.slice(0, 600),
      ts: Date.now(),
      status: "queued",
    };
    const items = [...outbox, item];
    await saveOutbox(items);
    setOutbox(items);
    setOutbox(await syncOutbox());
  };

  const startExam = (form: Form) => {
    setExam({ form, index: 0, attempts: [] });
    const t = getTemplate(EXAM_TEMPLATES[0]);
    if (t) setInst(instantiate(t, examSeed(form, 0)));
    go("exam");
  };

  const onExamStep = async (r: LessonResult) => {
    if (!exam) return;
    const all = [...exam.attempts, ...r.attempts];
    const nextIdx = exam.index + 1;
    if (nextIdx >= EXAM_TEMPLATES.length) {
      setExamScores(await saveExam(exam.form, all));
      setExam({ ...exam, index: nextIdx, attempts: all });
      go("exam-done");
    } else {
      const t = getTemplate(EXAM_TEMPLATES[nextIdx]);
      if (t) setInst(instantiate(t, examSeed(exam.form, nextIdx)));
      setExam({ ...exam, index: nextIdx, attempts: all });
      window.scrollTo({ top: 0 });
    }
  };

  const summary = useMemo(() => ({ ...summarize(settings.name, attempts), exam: examScores }), [settings.name, attempts, examScores]);

  if (screen === "loading") return <div className="min-h-dvh" />;

  const inLesson = screen === "task" || screen === "exam";

  return (
    <div className={`mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 ${inLesson ? "" : "pb-10 pt-4"}`}>
      {screen === "onboard" && (
        <Onboard
          lang={lang}
          name={settings.name}
          onLang={(l) => update({ lang: l })}
          onStart={(name) => {
            const first = !settings.name;
            update({ name: name || T.defaultName[lang] });
            if (first) startTask(tplIndex);
            else go("home");
          }}
        />
      )}

      {screen === "home" && (
        <Home
          lang={lang}
          name={settings.name}
          summary={summary}
          reviews={outbox.length}
          queued={outbox.filter((o) => o.status === "queued").length}
          examScores={examScores}
          onLang={(l) => update({ lang: l })}
          onStart={() => startTask(tplIndex)}
          onQr={() => go("qr")}
          onReviews={() => go("outbox")}
          onExam={() => go("exam-intro")}
          onRename={() => go("onboard")}
          onAbout={() => setAbout(true)}
        />
      )}

      {screen === "task" && inst && <Lesson key={`${inst.template.id}-${inst.seed}`} inst={inst} lang={lang} onDone={onDone} onExit={() => go("home")} />}

      {screen === "result" && inst && last && (
        <ResultView inst={inst} lang={lang} result={last} onAnother={another} onNext={() => startTask(tplIndex + 1)} onHome={() => go("home")} onEnqueue={enqueue} />
      )}

      {screen === "qr" && (
        <SubPage title={L(T.showQr)} lang={lang} onBack={() => go("home")}>
          <QrView code={encodeSummary(summary)} lang={lang} />
        </SubPage>
      )}

      {screen === "outbox" && (
        <SubPage title={L(T.aiReviews)} lang={lang} onBack={() => go("home")}>
          <OutboxView items={outbox} lang={lang} onSync={async () => setOutbox(await syncOutbox())} />
        </SubPage>
      )}

      {screen === "exam-intro" && (
        <SubPage title={L(T.exam)} lang={lang} onBack={() => go("home")}>
          <div className="card">
            <p className="text-[17px] leading-6">
              {lang === "kk"
                ? "Кеңессіз алты есеп. «Дейін» нұсқасын қазір, «кейін» нұсқасын бірнеше аптадан соң шығар: есептер сол, сандар басқа. Мұғалім айырманы көреді."
                : "Шесть задач без подсказок. Форму «до» реши сейчас, форму «после» — через несколько недель: задачи те же, числа другие. Учитель увидит разницу."}
            </p>
          </div>
          <div className="card flex flex-col !p-0">
            {(["A", "B"] as const).map((f, i) => (
              <div key={f} className={`flex min-h-14 items-center justify-between px-4 py-3 ${i ? "border-t border-line" : ""}`}>
                <span className="text-[17px] font-semibold">{f === "A" ? (lang === "kk" ? "Дейін" : "До") : lang === "kk" ? "Кейін" : "После"}</span>
                <span className="tnum text-[20px] font-extrabold">{examScores[f] !== undefined ? `${examScores[f]} / ${EXAM_MAX}` : "—"}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => startExam(examScores.A === undefined ? "A" : "B")}>
            {examScores.A === undefined ? (lang === "kk" ? "«Дейін» бастау" : "Начать «до»") : lang === "kk" ? "«Кейін» бастау" : "Начать «после»"}
          </button>
          {examScores.A !== undefined && (
            <button type="button" className="btn btn-secondary w-full" onClick={() => startExam("A")}>
              {lang === "kk" ? "«Дейін» қайта өту" : "Пройти «до» заново"}
            </button>
          )}
        </SubPage>
      )}

      {screen === "exam" && inst && exam && (
        <Lesson key={`exam-${exam.form}-${exam.index}`} inst={inst} lang={lang} exam={{ index: exam.index, total: EXAM_TEMPLATES.length }} onDone={onExamStep} onExit={() => go("home")} />
      )}

      {screen === "exam-done" && exam && (
        <div className="flex flex-col gap-4 pt-6">
          <h1 className="h-screen-title">{lang === "kk" ? "Өлшеу аяқталды" : "Замер завершён"}</h1>
          <div className="card text-center">
            <p className="tnum text-[48px] font-extrabold leading-none text-primary">
              {examScores[exam.form] ?? 0}
              <span className="text-[24px] text-text-2"> / {EXAM_MAX}</span>
            </p>
            <p className="t-2 mt-2">{lang === "kk" ? "дұрыс қадам" : "верных шагов"}</p>
          </div>
          <div className="card flex flex-col !p-0">
            {STAGES.map((st, i) => {
              const xs = exam.attempts.filter((a) => a.stage === st);
              return (
                <div key={st} className={`flex min-h-14 items-center justify-between px-4 ${i ? "border-t border-line" : ""}`}>
                  <span className="text-[17px] font-semibold">{L(STAGE_NAME[st])}</span>
                  <span className="tnum text-[20px] font-extrabold">
                    {xs.filter((a) => a.correct).length} / {xs.length}
                  </span>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => go("qr")}>
            {L(T.showQr)}
          </button>
          <button type="button" className="btn btn-secondary w-full" onClick={() => go("home")}>
            {L(T.home)}
          </button>
        </div>
      )}

      {about && <About lang={lang} onClose={() => setAbout(false)} />}
    </div>
  );
}

function LangSwitch({ lang, onChange, big }: { lang: Lang; onChange: (l: Lang) => void; big?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-1 rounded-[14px] border border-line bg-surface p-1 ${big ? "w-full" : ""}`} role="group" aria-label="Тіл / Язык">
      {(["kk", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`rounded-[10px] px-3 font-semibold transition-colors ${big ? "min-h-14 text-[17px]" : "min-h-10 text-[15px]"} ${lang === l ? "bg-primary text-white" : "text-text-2"}`}
        >
          {big ? (l === "kk" ? "Қазақша" : "Русский") : l === "kk" ? "Қаз" : "Рус"}
        </button>
      ))}
    </div>
  );
}

function Onboard({ lang, name, onLang, onStart }: { lang: Lang; name: string; onLang: (l: Lang) => void; onStart: (name: string) => void }) {
  const [v, setV] = useState(name);
  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col justify-center gap-6">
      <div>
        <p className="text-[40px] font-extrabold leading-none tracking-tight text-primary">Мән</p>
        <p className="mt-3 whitespace-pre-line text-[17px] leading-6 text-text-2">{T.oneLiner[lang]}</p>
      </div>
      <LangSwitch lang={lang} onChange={onLang} big />
      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">{T.yourName[lang]}</span>
        <input className="field-text" maxLength={20} value={v} placeholder={T.namePh[lang]} onChange={(e) => setV(e.target.value)} autoComplete="given-name" />
      </label>
      <button type="button" className="btn btn-primary" onClick={() => onStart(v.trim())}>
        {T.start[lang]}
      </button>
      <p className="t-2 text-center">{T.aiNote[lang]}</p>
    </div>
  );
}

function OfflinePill({ lang }: { lang: Lang }) {
  const online = useOnline();
  const ready = useOfflineReady();
  const good = ready || !online;
  const text = !online ? T.offlineNow[lang] : ready ? T.offlineReady[lang] : T.offlineLoading[lang];
  return (
    <div className={`flex min-h-11 items-center gap-2 rounded-[14px] px-3 py-2 ${good ? "bg-ok-soft text-ok" : "bg-surface text-text-2"}`}>
      <IconCloud className="shrink-0" />
      <span className="text-[15px] font-semibold leading-5">{text}</span>
    </div>
  );
}

function Home(props: {
  lang: Lang;
  name: string;
  summary: ReturnType<typeof summarize>;
  reviews: number;
  queued: number;
  examScores: ExamScores;
  onLang: (l: Lang) => void;
  onStart: () => void;
  onQr: () => void;
  onReviews: () => void;
  onExam: () => void;
  onRename: () => void;
  onAbout: () => void;
}) {
  const { lang, summary } = props;
  const weak = weakest(summary);
  const any = STAGES.some((s) => summary.stages[s].total > 0);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="text-[26px] font-extrabold tracking-tight text-primary">Мән</span>
        <span className="flex-1" />
        {/* Full navigation on purpose: client-side transitions need RSC requests that fail offline. */}
        <a className="inline-flex min-h-12 items-center px-1 text-[15px] font-semibold text-text underline decoration-line underline-offset-4" href="/teacher">
          {T.teacher[lang]}
        </a>
        <LangSwitch lang={lang} onChange={props.onLang} />
      </header>

      <h1 className="h-screen-title">
        {T.hello[lang]}, {props.name || T.defaultName[lang]}!
      </h1>

      <div className="rounded-[16px] bg-primary p-4 text-white shadow-[var(--shadow)]">
        <p className="text-[20px] font-bold leading-[26px]">{T.newTask[lang]}</p>
        <p className="mt-1 text-[15px] leading-5 text-white/90">{T.newTaskSub[lang]}</p>
        <button type="button" className="btn mt-4 min-h-14 w-full bg-white text-primary-text" onClick={props.onStart}>
          {T.startTask[lang]}
          <IconArrow />
        </button>
      </div>

      <OfflinePill lang={lang} />

      <h2 className="h-card mt-2">{T.progress[lang]}</h2>
      <div className="card flex flex-col gap-4">
        {!any && <p className="t-2">{T.noData[lang]}</p>}
        {STAGES.map((s, i) => {
          const v = pct(summary.stages[s]);
          const isWeak = weak === s;
          return (
            <div key={s} className={isWeak ? "-m-2 rounded-[12px] bg-mark-soft p-2" : ""}>
              <div className="flex items-center gap-3">
                <Badge tone={isWeak ? "mark" : "primary"} size={28}>
                  <span className="text-[15px] font-bold">{i + 1}</span>
                </Badge>
                <span className="flex-1 text-[17px] font-semibold">{STAGE_NAME[s][lang]}</span>
                <span className="tnum text-[20px] font-extrabold">{v === null ? "—" : `${v}%`}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-primary" style={{ width: `${v ?? 0}%` }} />
              </div>
              {v !== null && <p className="t-2 mt-1">{isWeak ? T.weakHere[lang] : levelWord(v, lang)}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-secondary" onClick={props.onQr}>
          {T.showQr[lang]}
        </button>
        <button type="button" className="btn btn-secondary" onClick={props.onReviews}>
          {T.aiReviews[lang]}
          {props.reviews > 0 && <span className="tnum rounded-full bg-primary-soft px-2 text-[15px] text-primary-text">{props.reviews}</span>}
        </button>
      </div>
      <button type="button" className="btn btn-secondary w-full" onClick={props.onExam}>
        {T.exam[lang]}
        {(props.examScores.A !== undefined || props.examScores.B !== undefined) && (
          <span className="tnum text-[15px] text-text-2">
            {props.examScores.A ?? "—"} → {props.examScores.B ?? "—"}
          </span>
        )}
      </button>
      {props.queued > 0 && <p className="t-2">{lang === "kk" ? `Талдау кезегінде: ${props.queued}` : `В очереди на разбор: ${props.queued}`}</p>}
      <div className="flex flex-wrap gap-x-6">
        <button type="button" className="btn-link" onClick={props.onRename}>
          {T.rename[lang]}
        </button>
        <button type="button" className="btn-link" onClick={props.onAbout}>
          {T.about[lang]}
        </button>
      </div>
      <p className="t-2">{T.aiNote[lang]}</p>
    </div>
  );
}

function About({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const n = CHECKED_VARIANTS.toLocaleString("ru-RU");
  const rows: [string, string][] =
    lang === "kk"
      ? [
          ["ЖИ қайда бар", "Есептерді, қате жолдарын және кеңестерді сабаққа дейін ЖИ (Claude) жазды. Желі болғанда сервердегі модель (Alem API, alemllm) шешіміңді талдап, сұрақ қояды — жауапты айтпайды."],
          ["ЖИ қайда жоқ", "Сабақ кезінде: нұсқалар мен қатені тану телефонның өзінде, интернетсіз есептеледі."],
          ["Тексерілді", `Автотест ${n} нұсқаны тексерді: дұрыс жауап ешбір қате жолмен сәйкес келмейді.`],
          ["Сервер мен база", "0 ₸: аккаунт пен дерекқор жоқ, нәтиже тек осы телефонда сақталады."],
        ]
      : [
          ["Где ИИ", "Задачи, ошибочные пути и подсказки до урока написал ИИ (Claude). Когда есть сеть, модель на сервере (Alem API, alemllm) разбирает твоё решение и задаёт вопрос — ответ не называет."],
          ["Где ИИ нет", "Во время урока: варианты и диагноз ошибки считает сам телефон, без интернета."],
          ["Проверено", `Автотест проверил ${n} вариантов: верный ответ не совпадает ни с одним ошибочным путём.`],
          ["Сервер и база", "0 ₸: аккаунтов и базы данных нет, результаты хранятся только на этом телефоне."],
        ];
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30" onClick={onClose}>
      <div className="sheet-in mx-auto max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[20px] bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-5" onClick={(e) => e.stopPropagation()}>
        <p className="h-card">{T.about[lang]}</p>
        <div className="mt-3 flex flex-col gap-3">
          {rows.map(([h, b]) => (
            <div key={h}>
              <p className="text-[17px] font-bold">{h}</p>
              <p className="text-[17px] leading-6 text-text-2">{b}</p>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary mt-5" onClick={onClose}>
          {T.close[lang]}
        </button>
      </div>
    </div>
  );
}

function SubPage({ title, lang, onBack, children }: { title: string; lang: Lang; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="btn-link self-start no-underline" onClick={onBack}>
        ← {T.back[lang]}
      </button>
      <h1 className="h-screen-title">{title}</h1>
      {children}
    </div>
  );
}

const STATUS_TEXT: Record<StageStatus, L> = {
  first: T.firstTry,
  retry: T.secondTry,
  hint: T.withHint,
  solution: T.withSolution,
};

function ResultView({
  inst,
  lang,
  result,
  onAnother,
  onNext,
  onHome,
  onEnqueue,
}: {
  inst: Instance;
  lang: Lang;
  result: LessonResult;
  onAnother: () => void;
  onNext: () => void;
  onHome: () => void;
  onEnqueue: (r: string) => Promise<void>;
}) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div>
        <p className="t-2">{inst.template.title[lang]}</p>
        <h1 className="h-screen-title mt-1">{T.done[lang]}</h1>
      </div>
      <div className="card flex flex-col !p-0">
        {STAGES.map((s, i) => {
          const info = result.info[s];
          const clean = info.status === "first";
          return (
            <div key={s} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
              <Badge tone={clean ? "ok" : "mark"} size={28}>
                {clean ? <IconCheck size={16} /> : <IconBang size={16} />}
              </Badge>
              <div className="flex-1">
                <p className="text-[17px] font-semibold">{STAGE_NAME[s][lang]}</p>
                <p className="t-2">
                  {STATUS_TEXT[info.status][lang]}
                  {!clean && info.errorType ? ` · ${ERROR_NAME[info.errorType][lang].toLowerCase()}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-primary !flex-col !gap-0" onClick={onAnother}>
        <span>{T.anotherVariant[lang]}</span>
        <span className="text-[15px] font-normal leading-5 opacity-90">{T.anotherVariantSub[lang]}</span>
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-secondary" onClick={onNext}>
          {T.otherTask[lang]}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onHome}>
          {T.home[lang]}
        </button>
      </div>

      {!open && !sent && (
        <button type="button" className="btn-link self-start" onClick={() => setOpen(true)}>
          {T.explainMine[lang]} →
        </button>
      )}
      {open && !sent && (
        <div className="card flex flex-col gap-3">
          <p className="text-[17px] leading-6">{T.explainPrompt[lang]}</p>
          <textarea className="field-text min-h-[120px]" maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="t-2 tnum text-right">{text.length} / 600</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!text.trim()}
            onClick={async () => {
              await onEnqueue(text.trim());
              setSent(true);
            }}
          >
            {T.send[lang]}
          </button>
        </div>
      )}
      {sent && (
        <div className="flex items-center gap-3 rounded-[14px] bg-primary-soft px-4 py-3">
          <IconCloud className="shrink-0" />
          <p className="text-[17px] leading-6">{online ? T.queuedOnline[lang] : T.queuedOffline[lang]}</p>
        </div>
      )}
    </div>
  );
}

function QrView({ code, lang }: { code: string; lang: Lang }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#19171b", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [code]);
  return (
    <>
      <p className="text-[17px] leading-6 text-text-2">{T.qrHelp[lang]}</p>
      <div className="card mx-auto w-full max-w-[320px]" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="card">
        <p className="t-2">{T.orCode[lang]}</p>
        <p className="tnum mt-1 select-all break-all text-[19px] font-bold">{code}</p>
      </div>
    </>
  );
}

function OutboxView({ items, lang, onSync }: { items: OutboxItem[]; lang: Lang; onSync: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      {items.length === 0 && <p className="text-[17px] leading-6 text-text-2">{T.noReviews[lang]}</p>}
      {[...items].reverse().map((it) => {
        const t = getTemplate(it.templateId);
        const done = it.status === "done" && it.result;
        return (
          <div key={it.id} className="card flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[17px] font-bold">{t?.title[lang] ?? it.templateId}</span>
              <span className={`rounded-full px-3 py-1 text-[15px] font-semibold ${done ? "bg-ok-soft text-ok" : "bg-primary-soft text-primary-text"}`}>
                {done ? T.ready[lang] : T.waiting[lang]}
              </span>
            </div>
            <p className="t-2">«{it.reasoning}»</p>
            {done && it.result ? (
              <div className="flex flex-col gap-1 rounded-[12px] bg-primary-soft p-3">
                <p className="text-[15px] font-semibold">{STAGE_NAME[it.result.stage][lang]}</p>
                <p className="text-[17px] leading-6">{it.result.feedback}</p>
                <p className="mt-1 text-[15px] font-semibold">{T.aiQuestion[lang]}</p>
                <p className="text-[17px] font-semibold leading-6">{it.result.question}</p>
              </div>
            ) : (
              t && (
                <div className="flex flex-col gap-1 rounded-[12px] bg-mark-soft p-3">
                  <p className="text-[15px] font-semibold">{T.meanwhile[lang]}</p>
                  {t.employ.hints.map((h, i) => (
                    <p key={i} className="text-[17px] leading-6">
                      {i + 1}. {h[lang]}
                    </p>
                  ))}
                </div>
              )
            )}
          </div>
        );
      })}
      {items.some((i) => i.status === "queued") && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSync();
            setBusy(false);
          }}
        >
          {T.syncNow[lang]}
        </button>
      )}
    </>
  );
}
