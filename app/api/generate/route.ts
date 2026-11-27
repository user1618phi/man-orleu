import { aiConfigured, completeJson } from "@/lib/llm";
import { GENERATE_SCHEMA, generateSystem, isRawGenerated, verifyGenerated } from "@/lib/ai-tasks";
import type { Lang } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!aiConfigured()) return Response.json({ error: "ai_unavailable" }, { status: 503 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const lang: Lang = b.lang === "ru" ? "ru" : "kk";
  const context = typeof b.context === "string" ? b.context.trim().slice(0, 1000) : "";
  if (context.length < 10) return Response.json({ error: "bad_request" }, { status: 400 });

  // A task whose arithmetic does not check out is never shown; ask again, the second time with the other model.
  const models = [process.env.ALEM_MODEL, process.env.ALEM_FALLBACK_MODEL, process.env.ALEM_MODEL];
  let reached = false;
  for (const alemModel of models) {
    const r = await completeJson({
      system: generateSystem(lang),
      user: `<teacher_context>\n${context}\n</teacher_context>`,
      schema: GENERATE_SCHEMA,
      validate: isRawGenerated,
      maxTokens: 4000,
      timeoutMs: 15000,
      ...(process.env.ALEM_API_KEY && alemModel ? { alemModel } : {}),
    });
    if (!r.ok) continue;
    reached = true;
    const task = verifyGenerated(r.value, lang, context);
    if (task) return Response.json(task);
  }
  return reached ? Response.json({ error: "unverified" }, { status: 422 }) : Response.json({ error: "ai_unavailable" }, { status: 503 });
}
