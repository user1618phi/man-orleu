"use client";

import { useMemo, useState } from "react";
import { StimulusView } from "./StimulusView";
import { checkEmploy, checkFormulate, choiceOrder, type Instance, type Verdict, type EmployVerdict } from "@/lib/engine";
import { ERROR_NAME, STAGE_DESC, STAGE_NAME, T } from "@/lib/i18n";
import { parseAnswer } from "@/lib/format";
import type { Attempt, Choice, ErrorType, L, Lang, Stage } from "@/lib/types";

export interface LessonResult {
  attempts: Attempt[];
  answer: number | null;
}

interface Props {
  inst: Instance;
  lang: Lang;
  onDone: (r: LessonResult) => void;
  onExit: () => void;
  /** Measurement mode: no feedback, no hints, steps advance on check. */
  exam?: { index: number; total: number };
}

const stamp = () => Date.now();

type Feedback = { correct: boolean; errorType?: ErrorType; lines: string[] };

export function Lesson({ inst, lang, onDone, onExit, exam }: Props) {
  const t = inst.template;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [firstAnswer, setFirstAnswer] = useState<number | null>(null);

  // step 1
  const [choice1, setChoice1] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fb1, setFb1] = useState<Feedback | null>(null);
  // step 2
  const [raw, setRaw] = useState("");
  const [fb2, setFb2] = useState<Feedback | null>(null);
  const [hints, setHints] = useState(0);
  const [inputErr, setInputErr] = useState(false);
  // step 3
  const choices3 = useMemo(() => t.interpret.choices(inst.params), [t, inst.params]);
  const order1 = useMemo(() => choiceOrder(inst.seed, t.formulate.choices.length, 0x51ed), [inst.seed, t]);
  const order3 = useMemo(() => choiceOrder(inst.seed, choices3.length, 0x7a3c), [inst.seed, choices3]);
  const [choice3, setChoice3] = useState<number | null>(null);
  const [fb3, setFb3] = useState<Feedback | null>(null);

  const L = (l: L) => l[lang];
  const record = (stage: Stage, correct: boolean, errorType?: ErrorType) =>
    setAttempts((a) => (a.some((x) => x.stage === stage) ? a : [...a, { templateId: t.id, seed: inst.seed, stage, correct, errorType, ts: Date.now() }]));

  const toggle = (id: string) => {
    if (fb1) return;
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const check1 = () => {
    if (choice1 === null) return;
    const v: Verdict = checkFormulate(inst, choice1, picked);
    const ch = t.formulate.choices[choice1];
    const lines: string[] = [L(ch.why)];
    if (ch.correct && v.extra?.length) lines.push(L(T.extraData));
    if (ch.correct && v.missed?.length) lines.push(L(T.missedData));
    if (!v.correct) lines.push(L(t.formulate.dataHint));
    record("formulate", v.correct, v.errorType);
    if (exam) {
      setStep(2);
      return;
    }
    setFb1({ correct: v.correct, errorType: v.errorType, lines });
  };

  const check2 = () => {
    const n = parseAnswer(raw);
    if (n === null) {
      setInputErr(true);
      return;
    }
    setInputErr(false);
    const v: EmployVerdict = checkEmploy(inst, n);
    if (firstAnswer === null) setFirstAnswer(n);
    const lines: string[] = [];
    if (v.correct) lines.push(L({ kk: "Дұрыс есептедің.", ru: "Посчитано верно." }));
    else if (v.bugIndex !== undefined) lines.push(L(t.employ.bugs[v.bugIndex].why));
    else lines.push(L(T.calcSlip));
    record("employ", v.correct, v.errorType);
    if (exam) {
      setStep(3);
      return;
    }
    setFb2({ correct: v.correct, errorType: v.errorType, lines });
    if (!v.correct) setHints((h) => Math.max(h, 1));
  };

  const check3 = () => {
    if (choice3 === null) return;
    const ch: Choice = choices3[choice3];
    if (exam) {
      const last: Attempt = { templateId: t.id, seed: inst.seed, stage: "interpret", correct: ch.correct, errorType: ch.correct ? undefined : (ch.errorType ?? "no_interpretation"), ts: stamp() };
      onDone({ attempts: [...attempts.filter((a) => a.stage !== "interpret"), last], answer: firstAnswer });
      return;
    }
    record("interpret", ch.correct, ch.correct ? undefined : (ch.errorType ?? "no_interpretation"));
    setFb3({ correct: ch.correct, errorType: ch.correct ? undefined : ch.errorType, lines: [L(ch.why)] });
  };

  const stage: Stage = step === 1 ? "formulate" : step === 2 ? "employ" : "interpret";

  return (
    <div className="flex flex-col gap-8 pb-28">
      <header className="flex items-center justify-between">
        <button type="button" className="link label" onClick={onExit}>
          ← {L(T.home)}
        </button>
        <span className="label num">
          {exam ? `${L({ kk: "өлшеу", ru: "замер" })} ${exam.index + 1} / ${exam.total}` : `${L(T.level)} ${inst.level} · #${inst.seed}`}
        </span>
      </header>

      <div>
        <p className="label">{L(t.title)}</p>
        <p className="mt-3 text-[17px] leading-relaxed">{L(t.situation)}</p>
      </div>

      <StimulusView
        stimulus={inst.stimulus}
        params={inst.params}
        lang={lang}
        picked={step === 1 ? picked : undefined}
        onToggle={step === 1 ? toggle : undefined}
        reveal={step === 1 && !!fb1}
      />

      <div className="ruler" aria-hidden />

      <StepHeader step={step} stage={stage} lang={lang} />

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <p className="text-[18px]">{L(t.formulate.prompt)}</p>
          <ChoiceList items={t.formulate.choices.map((c) => c.text[lang])} order={order1} value={choice1} onChange={fb1 ? undefined : setChoice1} />
          <p className="label">
            {L(T.markData)} · {L(T.marked)} {picked.size}
          </p>
          {fb1 && <FeedbackView fb={fb1} lang={lang} />}
          {!fb1 ? (
            <button type="button" className="btn primary block" disabled={choice1 === null} onClick={check1}>
              {L(T.check)}
            </button>
          ) : (
            <button type="button" className="btn primary block" onClick={() => setStep(2)}>
              {L(T.next)} →
            </button>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <p className="text-[18px]">{L(t.employ.prompt)}</p>
          <label className="flex items-center gap-3">
            <span className="sr-only">{L(T.yourAnswer)}</span>
            <input
              className="field num min-w-0 flex-1 !w-auto !text-[28px] !py-3"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="0"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check2()}
              aria-invalid={inputErr}
            />
            <span className="num shrink-0 text-[22px] text-mut">{L(t.employ.unit)}</span>
          </label>
          {inputErr && <p className="mark warn">{L(T.badNumber)}</p>}
          {fb2 && <FeedbackView fb={fb2} lang={lang} />}
          {hints > 0 && (
            <div className="flex flex-col gap-2 border-l-2 border-acc pl-4">
              {t.employ.hints.slice(0, hints).map((h, i) => (
                <p key={i} className="text-[15px]">
                  <span className="label">
                    {L(T.hint)} {i + 1}
                  </span>
                  <br />
                  {L(h)}
                </p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {!exam && hints < 2 && (
              <button type="button" className="btn" onClick={() => setHints((h) => h + 1)}>
                {hints === 0 ? L(T.hint) : L(T.hint2)}
              </button>
            )}
            {fb2 && !fb2.correct && (
              <button type="button" className="btn" onClick={() => setFb2(null)}>
                {L(T.retry)}
              </button>
            )}
          </div>
          {!fb2 ? (
            <button type="button" className="btn primary block" disabled={!raw.trim()} onClick={check2}>
              {L(T.check)}
            </button>
          ) : (
            <button type="button" className="btn primary block" onClick={() => setStep(3)}>
              {L(T.next)} →
            </button>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <p className="text-[18px]">{L(t.interpret.prompt)}</p>
          <ChoiceList items={choices3.map((c) => c.text[lang])} order={order3} value={choice3} onChange={fb3 ? undefined : setChoice3} />
          {fb3 && <FeedbackView fb={fb3} lang={lang} />}
          {!fb3 ? (
            <button type="button" className="btn primary block" disabled={choice3 === null} onClick={check3}>
              {L(T.check)}
            </button>
          ) : (
            <button type="button" className="btn primary block" onClick={() => onDone({ attempts, answer: firstAnswer })}>
              {L(T.finish)} →
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function StepHeader({ step, stage, lang }: { step: number; stage: Stage; lang: Lang }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="label num">
          {T.step[lang]} {step} {T.of3[lang]}
        </p>
        <h2 className="mt-1 text-[32px]">{STAGE_NAME[stage][lang]}</h2>
      </div>
      <p className="label max-w-[50%] text-right">{STAGE_DESC[stage][lang]}</p>
    </div>
  );
}

function ChoiceList({ items, order, value, onChange }: { items: string[]; order: number[]; value: number | null; onChange?: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-2" role="group">
      {order.map((i) => ({ i, txt: items[i] })).map(({ i, txt }) => (
        <button key={i} type="button" className="choice" aria-pressed={value === i} disabled={!onChange && value !== i} onClick={() => onChange?.(i)}>
          <span className="box" aria-hidden />
          <span>{txt}</span>
        </button>
      ))}
    </div>
  );
}

export function FeedbackView({ fb, lang }: { fb: Feedback; lang: Lang }) {
  return (
    <div className="enter flex flex-col gap-2 border-y border-line py-4" role="status" aria-live="polite">
      <p className={`mark ${fb.correct ? "ok" : "bad"}`}>
        {fb.correct ? T.correct[lang] : T.wrong[lang]}
        {fb.errorType ? ` · ${ERROR_NAME[fb.errorType][lang]}` : ""}
      </p>
      {fb.lines.map((l, i) => (
        <p key={i} className="text-[16px]">
          {l}
        </p>
      ))}
    </div>
  );
}
