"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StimulusView } from "./StimulusView";
import { Badge, IconBang, IconBulb, IconCheck, IconCross } from "./Icons";
import { checkData, checkEmploy, choiceOrder, type Instance } from "@/lib/engine";
import { ERROR_NAME, STAGE_NAME, T } from "@/lib/i18n";
import { num, parseAnswer } from "@/lib/format";
import type { Attempt, ErrorType, L, Lang, Stage } from "@/lib/types";

export type StageStatus = "first" | "retry" | "hint" | "solution";
export interface LessonResult {
  attempts: Attempt[];
  answer: number | null;
  info: Record<Stage, { status: StageStatus; errorType?: ErrorType }>;
}

interface Props {
  inst: Instance;
  lang: Lang;
  onDone: (r: LessonResult) => void;
  onExit: () => void;
  /** Measurement mode: no feedback, no hints, steps advance on check. */
  exam?: { index: number; total: number };
}

type Phase = "1a" | "1b" | "2" | "3";
type Sheet = { tone: "ok" | "bad"; title: string; text: string[] } | null;
type Track = { tries: number; hints: number; solution: boolean; firstErr?: ErrorType; first?: boolean };

const stamp = () => Date.now();
const STAGE_OF: Record<Phase, Stage> = { "1a": "formulate", "1b": "formulate", "2": "employ", "3": "interpret" };

export function Lesson({ inst, lang, onDone, onExit, exam }: Props) {
  const t = inst.template;
  const L = (l: L) => l[lang];
  const [phase, setPhase] = useState<Phase>("1a");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [track, setTrack] = useState<Record<Stage, Track>>({
    formulate: { tries: 0, hints: 0, solution: false },
    employ: { tries: 0, hints: 0, solution: false },
    interpret: { tries: 0, hints: 0, solution: false },
  });
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [firstAnswer, setFirstAnswer] = useState<number | null>(null);
  const [goodAnswer, setGoodAnswer] = useState<number | null>(null);
  const [first1a, setFirst1a] = useState<{ correct: boolean; err?: ErrorType } | null>(null);
  const questionRef = useRef<HTMLDivElement>(null);

  // 1A
  const order1 = useMemo(() => choiceOrder(inst.seed, t.formulate.choices.length, 0x51ed), [inst.seed, t]);
  const [c1, setC1] = useState<number | null>(null);
  const [out1, setOut1] = useState<Set<number>>(new Set());
  // 1B
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [badRows, setBadRows] = useState<Set<string>>(new Set());
  // 2
  const [raw, setRaw] = useState("");
  const [inputErr, setInputErr] = useState(false);
  // 3
  const choices3 = useMemo(() => t.interpret.choices(inst.params), [t, inst.params]);
  const order3 = useMemo(() => choiceOrder(inst.seed, choices3.length, 0x7a3c), [inst.seed, choices3]);
  const [c3, setC3] = useState<number | null>(null);
  const [out3, setOut3] = useState<Set<number>>(new Set());

  const stage = STAGE_OF[phase];

  useEffect(() => {
    if (phase !== "1a") questionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  const bump = (s: Stage, patch: Partial<Track>) => setTrack((tr) => ({ ...tr, [s]: { ...tr[s], ...patch } }));
  const record = (s: Stage, correct: boolean, errorType?: ErrorType) => {
    setAttempts((a) => (a.some((x) => x.stage === s) ? a : [...a, { templateId: t.id, seed: inst.seed, stage: s, correct, errorType, ts: stamp() }]));
    setTrack((tr) => (tr[s].first !== undefined ? tr : { ...tr, [s]: { ...tr[s], first: correct, firstErr: errorType } }));
  };

  const finish = (lastAttempts: Attempt[], tr: Record<Stage, Track>) => {
    const status = (x: Track): StageStatus => (x.solution ? "solution" : x.hints > 0 ? "hint" : x.first ? "first" : "retry");
    onDone({
      attempts: lastAttempts,
      answer: firstAnswer,
      info: {
        formulate: { status: status(tr.formulate), errorType: tr.formulate.firstErr },
        employ: { status: status(tr.employ), errorType: tr.employ.firstErr },
        interpret: { status: status(tr.interpret), errorType: tr.interpret.firstErr },
      },
    });
  };

  // ---------- checks ----------
  const check1a = () => {
    if (c1 === null) return;
    const ch = t.formulate.choices[c1];
    if (!first1a) setFirst1a({ correct: ch.correct, err: ch.correct ? undefined : (ch.errorType ?? "no_interpretation") });
    if (exam) {
      setPhase("1b");
      return;
    }
    if (ch.correct) setSheet({ tone: "ok", title: L(T.correct), text: [L(ch.why)] });
    else setSheet({ tone: "bad", title: L(ERROR_NAME[ch.errorType ?? "no_interpretation"]), text: [L(ch.why)] });
  };

  const check1b = () => {
    const v = checkData(inst, picked);
    if (!attempts.some((x) => x.stage === "formulate")) {
      const ok = (first1a?.correct ?? true) && v.correct;
      record("formulate", ok, ok ? undefined : first1a && !first1a.correct ? first1a.err : v.errorType);
    }
    if (exam) {
      setPhase("2");
      return;
    }
    if (v.correct) {
      setSheet({ tone: "ok", title: L(T.correct), text: [L({ kk: "Осы деректер есептеуге керек болады.", ru: "Эти данные понадобятся для расчёта." })] });
      return;
    }
    const text: string[] = [];
    if (v.extra.length) {
      setBadRows(new Set(v.extra.map((r) => r.id)));
      const names = v.extra.map((r) => (r.label ? L(r.label) : r.cells.map((c) => c.text(inst.params)[lang]).join(" "))).join(", ");
      text.push(`${L(T.notNeeded)}: ${names}.`);
    }
    if (v.missing) text.push(`${L(T.missingData)}. ${L(t.formulate.dataHint)}`);
    bump("formulate", { tries: track.formulate.tries + 1 });
    setSheet({ tone: "bad", title: L(ERROR_NAME[v.errorType ?? "wrong_data"]), text });
  };

  const check2 = () => {
    const n = parseAnswer(raw);
    if (n === null) {
      setInputErr(true);
      return;
    }
    setInputErr(false);
    const v = checkEmploy(inst, n);
    if (firstAnswer === null) setFirstAnswer(n);
    record("employ", v.correct, v.errorType);
    if (exam) {
      setPhase("3");
      return;
    }
    if (v.correct) {
      setGoodAnswer(n);
      setSheet({ tone: "ok", title: L(T.correct), text: [L({ kk: "Есептеу дұрыс.", ru: "Расчёт верный." })] });
    } else {
      bump("employ", { tries: track.employ.tries + 1 });
      const why = v.bugIndex !== undefined ? L(t.employ.bugs[v.bugIndex].why) : L(T.calcSlipWhy);
      setSheet({ tone: "bad", title: L(ERROR_NAME[v.errorType ?? "calc_slip"]), text: [why] });
    }
  };

  const check3 = () => {
    if (c3 === null) return;
    const ch = choices3[c3];
    const err = ch.correct ? undefined : (ch.errorType ?? "no_interpretation");
    if (exam) {
      const last: Attempt = { templateId: t.id, seed: inst.seed, stage: "interpret", correct: ch.correct, errorType: err, ts: stamp() };
      finish([...attempts.filter((a) => a.stage !== "interpret"), last], track);
      return;
    }
    record("interpret", ch.correct, err);
    if (ch.correct) setSheet({ tone: "ok", title: L(T.correct), text: [L(ch.why)] });
    else {
      bump("interpret", { tries: track.interpret.tries + 1 });
      setSheet({ tone: "bad", title: L(ERROR_NAME[err ?? "no_interpretation"]), text: [L(ch.why)] });
    }
  };

  // ---------- sheet actions ----------
  const next = () => {
    setSheet(null);
    if (phase === "1a") setPhase("1b");
    else if (phase === "1b") setPhase("2");
    else if (phase === "2") setPhase("3");
    else finish(attempts, track);
  };
  const retry = () => {
    setSheet(null);
    if (phase === "1a" && c1 !== null) {
      setOut1((s) => new Set(s).add(c1));
      setC1(null);
    }
    if (phase === "3" && c3 !== null) {
      setOut3((s) => new Set(s).add(c3));
      setC3(null);
    }
    if (phase === "2") setRaw("");
  };
  const hint = () => {
    setSheet(null);
    bump("employ", { hints: Math.min(2, track.employ.hints + 1) });
  };
  const solution = () => {
    setSheet(null);
    bump("employ", { solution: true, hints: 2 });
    if (!attempts.some((x) => x.stage === "employ")) record("employ", false, "calc_slip");
  };

  // ---------- primary button ----------
  let primary: { label: string; disabled: boolean; reason?: string; onClick: () => void };
  if (phase === "1a") primary = { label: L(T.check), disabled: c1 === null, reason: L(T.needChoice), onClick: check1a };
  else if (phase === "1b") primary = { label: L(T.check), disabled: picked.size === 0, reason: L(T.needRow), onClick: check1b };
  else if (phase === "2")
    primary = track.employ.solution
      ? { label: L(T.next), disabled: false, onClick: () => setPhase("3") }
      : { label: L(T.check), disabled: !raw.trim(), reason: L(T.needNumber), onClick: check2 };
  else primary = { label: L(T.check), disabled: c3 === null, reason: L(T.needChoice), onClick: check3 };

  const stageIdx = phase === "1a" || phase === "1b" ? 0 : phase === "2" ? 1 : 2;
  const seg = (i: number) => {
    if (i < stageIdx) return 100;
    if (i > stageIdx) return 0;
    return phase === "1b" ? 50 : 15;
  };
  const highlight = phase === "2" || phase === "3" ? picked : undefined;

  return (
    <div className="min-h-dvh">
      <div className="no-print sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={L(T.exit)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-text-2 active:bg-line"
            onClick={() => setConfirmExit(true)}
          >
            <IconCross size={22} />
          </button>
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-2 flex-1 overflow-hidden rounded bg-line">
                <div className="h-full rounded bg-primary transition-transform duration-300 ease-out" style={{ transform: `translateX(${seg(i) - 100}%)` }} />
              </div>
            ))}
          </div>
        </div>
        <p className="t-2 pl-[60px]">
          {exam ? `${lang === "kk" ? "Өлшеу" : "Замер"} ${exam.index + 1} ${L(T.of)} ${exam.total} · ` : ""}
          {lang === "kk" ? `${stageIdx + 1}/3 ${T.stepOf.kk}` : `${T.stepOf.ru} ${stageIdx + 1} из 3`} · {L(STAGE_NAME[stage])}
        </p>
      </div>

      <div className="flex flex-col gap-3 pb-[280px] pt-2">
        <div className="card">
          <p className="t-2">{L(T.condition)}</p>
          <h2 className="h-card mt-1">{L(t.title)}</h2>
          <p className="mt-2 text-[17px] leading-6">{L(t.situation)}</p>
        </div>

        {phase === "1a" && (
          <section ref={questionRef} className="flex scroll-mt-24 flex-col gap-3 pt-3">
            <h3 className="h-card">{L(T.whatToFind)}</h3>
            <Options
              items={t.formulate.choices.map((c) => L(c.text))}
              order={order1}
              value={c1}
              out={out1}
              locked={!!sheet}
              result={sheet ? sheet.tone : null}
              onChange={setC1}
            />
          </section>
        )}

        {phase === "1b" && (
          <div ref={questionRef} className="scroll-mt-24 pt-3">
            <h3 className="h-card">{L(T.whatData)}</h3>
            <div className="mt-2 flex items-center gap-3 rounded-[14px] bg-mark-soft px-4 py-3">
              <IconBulb className="shrink-0" />
              <p className="text-[17px] leading-6">{L(T.tapRows)}</p>
            </div>
          </div>
        )}

        <StimulusView
          stimulus={inst.stimulus}
          params={inst.params}
          lang={lang}
          mode={phase === "1b" && !sheet ? "select" : "view"}
          picked={phase === "1b" ? picked : undefined}
          onToggle={(id) => {
            setBadRows((b) => {
              const n = new Set(b);
              n.delete(id);
              return n;
            });
            setPicked((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            });
          }}
          highlight={highlight}
          bad={phase === "1b" ? badRows : undefined}
        />

        {phase === "1b" && <p className="t-2 tnum">{`${L(T.selected)}: ${picked.size}`}</p>}

        {phase === "2" && (
          <section ref={questionRef} className="flex scroll-mt-24 flex-col gap-3 pt-3">
            <h3 className="h-card">{L(t.employ.prompt)}</h3>
            <div className="flex items-center gap-3">
              <input
                className="field-num"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="0"
                aria-label={L(t.employ.prompt)}
                value={raw}
                disabled={track.employ.solution || sheet?.tone === "ok"}
                onChange={(e) => setRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sheet && raw.trim()) check2();
                }}
              />
              <span className="shrink-0 text-[22px] font-bold text-text-2">{L(t.employ.unit)}</span>
            </div>
            {inputErr && <p className="text-[15px] font-semibold text-bad">{L(T.badNumber)}</p>}
            <p className="t-2">{L(T.paper)}</p>
            {track.employ.hints > 0 && (
              <div className="flex flex-col gap-3">
                {t.employ.hints.slice(0, track.employ.hints).map((h, i) => (
                  <div key={i} className="flex gap-3 rounded-[14px] border-l-4 border-mark bg-mark-soft px-4 py-3">
                    <IconBulb className="mt-0.5 shrink-0" />
                    <p className="text-[17px] leading-6">
                      <span className="font-bold">
                        {L(T.hintN)} {i + 1} {L(T.of)} 2.{" "}
                      </span>
                      {L(h)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {track.employ.solution && (
              <div className="card border-2 !border-primary">
                <p className="font-bold">{L(T.solution)}</p>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
                  {t.employ.hints.map((h, i) => (
                    <li key={i}>{L(h)}</li>
                  ))}
                </ol>
                <p className="mt-3 text-[20px] font-extrabold">
                  {L(T.answerIs)}: <span className="tnum">{num(t.employ.answer(inst.params))}</span> {L(t.employ.unit)}
                </p>
              </div>
            )}
            {!exam && !sheet && !track.employ.solution && track.employ.hints < 2 && (
              <button type="button" className="btn-link self-start" onClick={hint}>
                {L(T.hintN)} {track.employ.hints + 1} {L(T.of)} 2
              </button>
            )}
          </section>
        )}

        {phase === "3" && (
          <section ref={questionRef} className="flex scroll-mt-24 flex-col gap-3 pt-3">
            {goodAnswer !== null && (
              <div className="flex items-center gap-3 rounded-[14px] bg-primary-soft px-4 py-3">
                <span className="text-[17px]">{L(T.yourCalc)}:</span>
                <span className="tnum text-[20px] font-extrabold">
                  {num(goodAnswer)} {L(t.employ.unit)}
                </span>
              </div>
            )}
            <h3 className="h-card">{L(t.interpret.prompt)}</h3>
            <Options
              items={choices3.map((c) => L(c.text))}
              order={order3}
              value={c3}
              out={out3}
              locked={!!sheet}
              result={sheet ? sheet.tone : null}
              onChange={setC3}
            />
          </section>
        )}
      </div>

      <div className="no-print fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-[480px]">
          {sheet ? (
            <div
              role="status"
              aria-live="polite"
              className={`sheet-in rounded-t-[20px] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-6px_24px_rgba(25,23,27,.12)] ${sheet.tone === "ok" ? "bg-ok-soft" : "bg-bad-soft"}`}
            >
              <div className="flex items-start gap-3">
                <span className="pop">
                  <Badge tone={sheet.tone}>{sheet.tone === "ok" ? <IconCheck /> : <IconBang />}</Badge>
                </span>
                <div className="flex-1">
                  <p className={`text-[20px] font-bold leading-[26px] ${sheet.tone === "ok" ? "text-ok" : "text-bad"}`}>{sheet.title}</p>
                  {sheet.text.map((x, i) => (
                    <p key={i} className="mt-1 text-[17px] leading-6">
                      {x}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {sheet.tone === "ok" ? (
                  <button type="button" className="btn btn-ok" onClick={next}>
                    {phase === "3" ? L(T.finish) : L(T.next)}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-primary" onClick={retry}>
                      {L(T.tryAgain)}
                    </button>
                    {phase === "2" && track.employ.hints < 2 && (
                      <button type="button" className="btn btn-secondary w-full" onClick={hint}>
                        {L(T.hintN)} {track.employ.hints + 1} {L(T.of)} 2
                      </button>
                    )}
                    {phase === "2" && track.employ.hints >= 2 && (
                      <button type="button" className="btn btn-secondary w-full" onClick={solution}>
                        {L(T.showSolution)}
                      </button>
                    )}
                    {phase !== "2" && (
                      <button type="button" className="btn-link self-center" onClick={next}>
                        {phase === "3" ? L(T.finish) : L(T.next)}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-line bg-bg px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
              <button type="button" className="btn btn-primary" disabled={primary.disabled} onClick={primary.onClick}>
                {primary.label}
              </button>
              {primary.disabled && primary.reason && <p className="t-2 mt-1 text-center">{primary.reason}</p>}
            </div>
          )}
        </div>
      </div>

      {confirmExit && (
        <div className="no-print fixed inset-0 z-40 flex items-end bg-black/30" onClick={() => setConfirmExit(false)}>
          <div className="sheet-in mx-auto w-full max-w-[480px] rounded-t-[20px] bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-5" onClick={(e) => e.stopPropagation()}>
            <p className="h-card">{L(T.exitQ)}</p>
            <p className="t-2 mt-1">{L(T.exitSub)}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setConfirmExit(false)}>
                {L(T.stay)}
              </button>
              <button type="button" className="btn btn-secondary w-full" onClick={onExit}>
                {L(T.exit)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Options({
  items,
  order,
  value,
  out,
  locked,
  result,
  onChange,
}: {
  items: string[];
  order: number[];
  value: number | null;
  out: Set<number>;
  locked: boolean;
  result: "ok" | "bad" | null;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {order.map((i) => {
        const isOut = out.has(i);
        const sel = value === i;
        const state = sel && result ? result : isOut ? "bad" : undefined;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={sel}
            data-state={state}
            disabled={locked || isOut}
            className={`option ${isOut ? "opacity-60" : ""}`}
            onClick={() => onChange(i)}
          >
            {state === "ok" ? (
              <Badge tone="ok" size={22}>
                <IconCheck size={14} />
              </Badge>
            ) : state === "bad" ? (
              <Badge tone="bad" size={22}>
                <IconCross size={14} />
              </Badge>
            ) : (
              <span className="dot" aria-hidden />
            )}
            <span>{items[i]}</span>
          </button>
        );
      })}
    </div>
  );
}
