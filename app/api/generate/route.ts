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

  const r = await completeJson({
    system: generateSystem(lang),
    user: `<teacher_context>\n${context}\n</teacher_context>`,
    schema: GENERATE_SCHEMA,
    validate: isRawGenerated,
    maxTokens: 8000,
    timeoutMs: 20000,
  });
  if (!r.ok) return Response.json({ error: "ai_unavailable" }, { status: 503 });
  const task = verifyGenerated(r.value, lang, context);
  if (!task) return Response.json({ error: "unverified" }, { status: 422 });
  return Response.json(task);
}
