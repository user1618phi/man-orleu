import { getTemplate, instantiate } from "@/lib/engine";
import { aiConfigured, completeJson } from "@/lib/llm";
import { EXPLAIN_SCHEMA, explainSystem, explainUser, isExplain, leaksAnswer } from "@/lib/ai-tasks";
import type { Lang } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!aiConfigured()) return Response.json({ error: "ai_unavailable" }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const lang: Lang = b.lang === "ru" ? "ru" : "kk";
  const t = typeof b.templateId === "string" ? getTemplate(b.templateId) : undefined;
  const seed = typeof b.seed === "number" && Number.isInteger(b.seed) && b.seed >= 0 ? b.seed : null;
  const answer = typeof b.answer === "number" && Number.isFinite(b.answer) ? b.answer : null;
  const reasoning = typeof b.reasoning === "string" ? b.reasoning.trim().slice(0, 600) : "";
  if (!t || seed === null || !reasoning) return Response.json({ error: "bad_request" }, { status: 400 });

  const inst = instantiate(t, seed);
  const r = await completeJson({
    system: explainSystem(lang),
    user: explainUser(inst, lang, answer, reasoning),
    schema: EXPLAIN_SCHEMA,
    validate: isExplain,
    maxTokens: 2000,
    timeoutMs: 20000,
  });
  if (!r.ok) return Response.json({ error: "ai_unavailable" }, { status: 503 });

  // Never pass the answer through: fall back to the pre-written hints for the employ step.
  if (leaksAnswer(r.value, t.employ.answer(inst.params), reasoning)) {
    return Response.json({ stage: "employ", feedback: t.employ.hints[1][lang], question: t.employ.hints[0][lang] });
  }
  return Response.json({ stage: r.value.stage, feedback: r.value.feedback, question: r.value.question });
}
