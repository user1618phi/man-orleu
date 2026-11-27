// Usage: ALEM_API_KEY=... pnpm exec tsx scripts/alem-smoke.ts [model ...]
// Runs our two prompts (review and generation) × kk/ru × models; prints JSON validity, answer leak, time, preview.
import { completeJson } from "../lib/llm";
import { EXPLAIN_SCHEMA, GENERATE_SCHEMA, explainSystem, explainUser, generateSystem, isExplain, isRawGenerated, leaksAnswer, verifyGenerated } from "../lib/ai-tasks";
import { getTemplate, instantiate } from "../lib/engine";
import type { Lang } from "../lib/types";

if (!process.env.ALEM_API_KEY) {
  console.error("Set ALEM_API_KEY first (it is never printed).");
  process.exit(1);
}
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["alemllm", "kazllm", "gpt-oss", "qwen3-6"];
const REASONING: Record<Lang, string> = {
  ru: "Я взял последний автобус в 9:20, он приезжает в 10:20, значит успеваю, до приёма ещё время есть.",
  kk: "Мен соңғы автобусты алдым, ол 10:20-да келеді, сондықтан үлгеремін.",
};
const CONTEXT: Record<Lang, string> = {
  ru: "В нашем селе магазин продаёт хлеб по 180 тенге, а пекарня в райцентре — по 150, но билет на автобус туда и обратно 400 тенге.",
  kk: "Біздің ауылдағы дүкенде нан 180 теңге, аудан орталығындағы наубайханада 150 теңге, бірақ автобус билеті барып-қайту 400 теңге.",
};

void (async () => {
  const bus = getTemplate("bus");
  if (!bus) throw new Error("no bus template");
  const inst = instantiate(bus, 4);
  for (const model of models) {
    for (const lang of ["kk", "ru"] as const) {
      let t0 = Date.now();
      const e = await completeJson({ system: explainSystem(lang), user: explainUser(inst, lang, 15, REASONING[lang]), schema: EXPLAIN_SCHEMA, validate: isExplain, maxTokens: 2000, timeoutMs: 20000, alemModel: model });
      const leak = e.ok && leaksAnswer(e.value, bus.employ.answer(inst.params), REASONING[lang]);
      console.log(`explain  ${model.padEnd(8)} ${lang} json=${e.ok} leak=${leak} ${Date.now() - t0}ms ${e.ok ? JSON.stringify(e.value).slice(0, 200) : e.reason}`);
      t0 = Date.now();
      const g = await completeJson({ system: generateSystem(lang), user: `<teacher_context>\n${CONTEXT[lang]}\n</teacher_context>`, schema: GENERATE_SCHEMA, validate: isRawGenerated, maxTokens: 8000, timeoutMs: 20000, alemModel: model });
      const verified = g.ok ? verifyGenerated(g.value, lang, CONTEXT[lang]) !== null : false;
      console.log(`generate ${model.padEnd(8)} ${lang} json=${g.ok} arithmetic=${verified} ${Date.now() - t0}ms ${g.ok ? JSON.stringify(g.value).slice(0, 200) : g.reason}`);
    }
  }
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
