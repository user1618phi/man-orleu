"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Lesson, type LessonResult } from "./Lesson";
import { NetBadge } from "./NetBadge";
import { instantiate, seedFor, getTemplate, type Instance } from "@/lib/engine";
import { TEMPLATES } from "@/lib/templates";
import { ERROR_NAME, STAGE_DESC, STAGE_NAME, T } from "@/lib/i18n";
import { addAttempts, loadAttempts, loadOutbox, loadSettings, saveOutbox, saveSettings, syncOutbox, type Settings } from "@/lib/store";
import { encodeSummary, pct, summarize, weakest } from "@/lib/profile";
import { STAGES, type Attempt, type Lang, type Level, type OutboxItem } from "@/lib/types";

type Screen = "loading" | "onboard" | "home" | "task" | "result" | "qr" | "outbox";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [settings, setSettings] = useState<Settings>({ lang: "kk", name: "", level: 1, streak: 0 });
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [inst, setInst] = useState<Instance | null>(null);
  const [tplIndex, setTplIndex] = useState(0);
  const [last, setLast] = useState<{ result: LessonResult; levelMsg: "up" | "down" | null } | null>(null);
  const lang = settings.lang;

  useEffect(() => {
    (async () => {
      const [s, a, o] = await Promise.all([loadSettings(), loadAttempts(), loadOutbox()]);
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

  const startTask = (templateIndex: number) => {
    const t = TEMPLATES[templateIndex % TEMPLATES.length];
    setTplIndex(templateIndex % TEMPLATES.length);
    setInst(instantiate(t, seedFor(settings.level)));
    setScreen("task");
    window.scrollTo({ top: 0 });
  };

  const another = () => {
    if (!inst) return;
    let seed = seedFor(settings.level);
    if (seed === inst.seed) seed += 3;
    setInst(instantiate(inst.template, seed));
    setScreen("task");
    window.scrollTo({ top: 0 });
  };

  const onDone = async (result: LessonResult) => {
    const all = await addAttempts(result.attempts);
    setAttempts(all);
    const ok = (st: string) => result.attempts.find((a) => a.stage === st)?.correct ?? false;
    let { level, streak } = settings;
    let levelMsg: "up" | "down" | null = null;
    if (!ok("formulate")) {
      if (level > 1) levelMsg = "down";
      level = Math.max(1, level - 1) as Level;
      streak = 0;
    } else if (ok("employ") && ok("interpret")) {
      streak += 1;
      if (streak >= 2) {
        if (level < 3) levelMsg = "up";
        level = Math.min(3, level + 1) as Level;
        streak = 0;
      }
    } else streak = 0;
    update({ level, streak });
    setLast({ result, levelMsg });
    setScreen("result");
    window.scrollTo({ top: 0 });
  };

  const enqueue = async (reasoning: string) => {
    if (!inst || !last) return;
    const item: OutboxItem = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      templateId: inst.template.id,
      seed: inst.seed,
      lang,
      answer: last.result.answer ?? 0,
      reasoning: reasoning.slice(0, 600),
      ts: Date.now(),
      status: "queued",
    };
    const items = [...outbox, item];
    await saveOutbox(items);
    setOutbox(items);
    setOutbox(await syncOutbox());
  };

  const queued = outbox.filter((o) => o.status === "queued").length;
  const summary = useMemo(() => summarize(settings.name, attempts), [settings.name, attempts]);

  if (screen === "loading") return <Shell lang={lang} onLang={(l) => update({ lang: l })} queued={0} />;

  return (
    <Shell lang={lang} onLang={(l) => update({ lang: l })} queued={queued}>
      {screen === "onboard" && <Onboard lang={lang} onStart={(name) => { update({ name }); setScreen("home"); }} />}

      {screen === "home" && (
        <div className="flex flex-col gap-12">
          <div className="enter">
            <p className="label">{settings.name || "—"}</p>
            <h1 className="mt-3 whitespace-pre-line text-[44px]">
              {T.tagline[lang].split("\n")[0]}
              {"\n"}
              <span className="text-acc-text">{T.tagline[lang].split("\n")[1]}</span>
            </h1>
          </div>
          <ProfileView summary={summary} lang={lang} />
          <div className="flex flex-col gap-3">
            <button type="button" className="btn primary block !min-h-[60px] !text-[18px]" onClick={() => startTask(tplIndex)}>
              {T.startTask[lang]} →
            </button>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn flex-1" onClick={() => setScreen("qr")}>
                {T.showQr[lang]}
              </button>
              <button type="button" className="btn flex-1" onClick={() => setScreen("outbox")}>
                {T.myQueue[lang]} <span className="num text-mut">{outbox.length}</span>
              </button>
            </div>
            <p className="label num">
              {T.level[lang]} {settings.level} / 3 · {TEMPLATES.length} {lang === "kk" ? "есеп үлгісі" : "шаблонов задач"}
            </p>
          </div>
          <footer className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="label">{T.aiNote[lang]}</p>
            <div className="flex gap-6">
              {/* Full navigation on purpose: client-side transitions need RSC requests that fail offline. */}
              <a className="link label" href="/teacher">
                {T.teacher[lang]} →
              </a>
              <button type="button" className="link label" onClick={() => setScreen("onboard")}>
                {T.rename[lang]}
              </button>
            </div>
          </footer>
        </div>
      )}

      {screen === "task" && inst && <Lesson key={`${inst.template.id}-${inst.seed}`} inst={inst} lang={lang} onDone={onDone} onExit={() => setScreen("home")} />}

      {screen === "result" && inst && last && (
        <ResultView
          inst={inst}
          lang={lang}
          result={last.result}
          levelMsg={last.levelMsg}
          onAnother={another}
          onNext={() => startTask(tplIndex + 1)}
          onHome={() => setScreen("home")}
          onEnqueue={enqueue}
        />
      )}

      {screen === "qr" && <QrView code={encodeSummary(summary)} lang={lang} onBack={() => setScreen("home")} />}

      {screen === "outbox" && (
        <OutboxView
          items={outbox}
          lang={lang}
          onBack={() => setScreen("home")}
          onSync={async () => setOutbox(await syncOutbox())}
        />
      )}
    </Shell>
  );
}

function Shell({ lang, onLang, queued, children }: { lang: Lang; onLang: (l: Lang) => void; queued: number; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4">
      <div className="panel sticky top-2 z-10 mb-8 flex items-center justify-between gap-3 px-4 py-3">
        <span className="font-mono text-[20px] tracking-tight">мән</span>
        <NetBadge lang={lang} queued={queued} />
        <LangSwitch lang={lang} onChange={onLang} />
      </div>
      <main className="flex-1 pb-12">{children}</main>
    </div>
  );
}

function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="relative grid grid-cols-2 rounded-[10px] border border-line p-0.5" role="group" aria-label="language">
      <span
        aria-hidden
        className="absolute bottom-0.5 top-0.5 w-[calc(50%-2px)] rounded-[8px] bg-fg transition-transform duration-[560ms] [transition-timing-function:var(--ease-spring)]"
        style={{ transform: lang === "kk" ? "translateX(2px)" : "translateX(calc(100% + 2px))" }}
      />
      {(["kk", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className={`relative z-10 min-h-[36px] min-w-[40px] px-2 font-mono text-[13px] transition-colors ${lang === l ? "text-bg" : "text-mut"}`}
        >
          {l === "kk" ? "қаз" : "рус"}
        </button>
      ))}
    </div>
  );
}

function Onboard({ lang, onStart }: { lang: Lang; onStart: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-10">
      <div className="enter">
        <h1 className="whitespace-pre-line text-[48px]">
          {T.tagline[lang].split("\n")[0]}
          {"\n"}
          <span className="text-acc-text">{T.tagline[lang].split("\n")[1]}</span>
        </h1>
        <p className="mt-6 text-[17px] text-mut">
          {lang === "kk"
            ? "Өмірдегі есептер үш қадаммен: түсін, есепте, түсіндір. Интернетсіз жұмыс істейді."
            : "Задачи из жизни в три шага: понять, посчитать, истолковать. Работает без интернета."}
        </p>
      </div>
      <label className="flex flex-col gap-2">
        <span className="label">{T.yourName[lang]}</span>
        <input className="field !text-[18px]" maxLength={20} value={name} placeholder={T.namePh[lang]} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </label>
      <button type="button" className="btn primary block" disabled={!name.trim()} onClick={() => onStart(name.trim())}>
        {T.start[lang]} →
      </button>
      <p className="label">{T.aiNote[lang]}</p>
    </div>
  );
}

function ProfileView({ summary, lang }: { summary: ReturnType<typeof summarize>; lang: Lang }) {
  const weak = weakest(summary);
  const any = STAGES.some((s) => summary.stages[s].total > 0);
  const topErr = Object.entries(summary.errors).sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="flex flex-col gap-3">
      <p className="label">{T.profile[lang]}</p>
      {!any && <p className="text-[16px] text-mut">{T.noData[lang]}</p>}
      <div className="flex flex-col">
        {STAGES.map((s, i) => {
          const v = pct(summary.stages[s]);
          const isWeak = weak === s;
          return (
            <div key={s} className="flex items-center gap-4 border-b border-line py-3 first:border-t">
              <span className="label num w-4">{i + 1}</span>
              <div className="flex-1">
                <p className="text-[17px]">{STAGE_NAME[s][lang]}</p>
                <p className="label">{isWeak ? T.stageWeak[lang] : STAGE_DESC[s][lang]}</p>
                <div className="mt-2 h-[3px] w-full bg-line">
                  <div className={`h-full ${isWeak ? "bg-acc" : "bg-fg"}`} style={{ width: `${v ?? 0}%` }} />
                </div>
              </div>
              <span className={`num text-[28px] ${isWeak ? "text-acc-text" : ""}`}>{v === null ? "—" : `${v}%`}</span>
            </div>
          );
        })}
      </div>
      {topErr && topErr[1] > 0 && (
        <p className="mark bad">
          {lang === "kk" ? "жиі қате" : "частая ошибка"}: {ERROR_NAME[topErr[0] as keyof typeof ERROR_NAME][lang]} · {topErr[1]}
        </p>
      )}
    </section>
  );
}

function ResultView({
  inst,
  lang,
  result,
  levelMsg,
  onAnother,
  onNext,
  onHome,
  onEnqueue,
}: {
  inst: Instance;
  lang: Lang;
  result: LessonResult;
  levelMsg: "up" | "down" | null;
  onAnother: () => void;
  onNext: () => void;
  onHome: () => void;
  onEnqueue: (r: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const byStage = (s: string) => result.attempts.find((a) => a.stage === s);
  const firstBad = STAGES.find((s) => !byStage(s)?.correct);
  return (
    <div className="flex flex-col gap-10">
      <div className="enter">
        <p className="label">{inst.template.title[lang]}</p>
        <h1 className="mt-3 text-[40px]">
          {firstBad ? (
            <>
              {lang === "kk" ? "Қиындық —" : "Сложность —"}
              <br />
              <span className="text-acc-text">{STAGE_NAME[firstBad][lang].toLowerCase()}</span>
            </>
          ) : lang === "kk" ? (
            "Үш қадам да дұрыс"
          ) : (
            "Все три шага верно"
          )}
        </h1>
      </div>
      <div className="flex flex-col">
        {STAGES.map((s, i) => {
          const a = byStage(s);
          return (
            <div key={s} className="flex items-center justify-between border-b border-line py-3 first:border-t">
              <span className="text-[17px]">
                <span className="label num mr-3">{i + 1}</span>
                {STAGE_NAME[s][lang]}
              </span>
              <span className={`mark ${a?.correct ? "ok" : "bad"}`}>
                {a?.correct ? T.correct[lang] : a?.errorType ? ERROR_NAME[a.errorType][lang] : T.wrong[lang]}
              </span>
            </div>
          );
        })}
      </div>
      {levelMsg && <p className="mark info">{levelMsg === "up" ? T.levelUp[lang] : T.levelDown[lang]}</p>}

      <div className="flex flex-col gap-3">
        <button type="button" className="btn primary block !min-h-[60px] !flex-col !gap-1" onClick={onAnother}>
          <span className="text-[18px]">{T.anotherVariant[lang]}</span>
          <span className="font-mono text-[12px] opacity-80">{T.anotherVariantSub[lang]}</span>
        </button>
        <div className="flex gap-3">
          <button type="button" className="btn flex-1" onClick={onNext}>
            {T.nextTask[lang]}
          </button>
          <button type="button" className="btn flex-1" onClick={onHome}>
            {T.home[lang]}
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        {!open && !sent && (
          <button type="button" className="link self-start" onClick={() => setOpen(true)}>
            {T.explainMine[lang]}
          </button>
        )}
        {open && !sent && (
          <>
            <p className="text-[16px]">{T.explainPrompt[lang]}</p>
            <textarea className="field min-h-[120px]" maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="label num text-right">{text.length} / 600</p>
            <button
              type="button"
              className="btn block"
              disabled={!text.trim()}
              onClick={async () => {
                await onEnqueue(text.trim());
                setSent(true);
              }}
            >
              {T.send[lang]}
            </button>
          </>
        )}
        {sent && <p className="mark info">{T.queued[lang]}</p>}
      </section>
    </div>
  );
}

function QrView({ code, lang, onBack }: { code: string; lang: Lang; onBack: () => void }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#19171b", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [code]);
  return (
    <div className="flex flex-col gap-8">
      <button type="button" className="link label self-start" onClick={onBack}>
        ← {T.back[lang]}
      </button>
      <h2 className="text-[32px]">{T.showQr[lang]}</h2>
      <p className="text-[16px] text-mut">{T.qrHelp[lang]}</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[18px] bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <p className="label">{T.orCode[lang]}</p>
        <p className="num mt-2 select-all break-all text-[18px]">{code}</p>
      </div>
    </div>
  );
}

function OutboxView({ items, lang, onBack, onSync }: { items: OutboxItem[]; lang: Lang; onBack: () => void; onSync: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <button type="button" className="link label self-start" onClick={onBack}>
        ← {T.back[lang]}
      </button>
      <h2 className="text-[32px]">{T.myQueue[lang]}</h2>
      {items.length === 0 && <p className="text-mut">{T.explainPrompt[lang]}</p>}
      <div className="flex flex-col">
        {[...items].reverse().map((it) => {
          const t = getTemplate(it.templateId);
          return (
            <div key={it.id} className="flex flex-col gap-2 border-b border-line py-4 first:border-t">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[17px]">{t?.title[lang] ?? it.templateId}</span>
                <span className={`mark ${it.status === "done" ? "ok" : "info"}`}>{it.status === "done" ? T.done[lang] : T.pending[lang]}</span>
              </div>
              <p className="label">«{it.reasoning}»</p>
              {it.status === "done" && it.result ? (
                <div className="flex flex-col gap-2 border-l-2 border-acc pl-4">
                  <p className="label">{STAGE_NAME[it.result.stage][lang]}</p>
                  <p>{it.result.feedback}</p>
                  <p className="label">{T.aiQuestion[lang]}</p>
                  <p className="text-[17px]">{it.result.question}</p>
                </div>
              ) : (
                t && (
                  <div className="flex flex-col gap-1">
                    <p className="label">{T.meanwhile[lang]}</p>
                    {t.employ.hints.map((h, i) => (
                      <p key={i} className="text-[15px]">
                        {i + 1}. {h[lang]}
                      </p>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
      {items.some((i) => i.status === "queued") && (
        <button
          type="button"
          className="btn block"
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
    </div>
  );
}
