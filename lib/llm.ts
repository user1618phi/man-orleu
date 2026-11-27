import Anthropic from "@anthropic-ai/sdk";

// Server-only. Provider order: Alem API (ALEM_API_KEY) → Anthropic (ANTHROPIC_API_KEY) → none (caller answers 503).

export interface JsonCall<T> {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  validate: (x: unknown) => x is T;
  maxTokens: number;
  timeoutMs: number;
  /** Smoke tests only: force one Alem model. */
  alemModel?: string;
}

export type JsonResult<T> = { ok: true; value: T; provider: "alem" | "anthropic"; model: string } | { ok: false; reason: string };

export function aiConfigured(): boolean {
  return !!(process.env.ALEM_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** First balanced {...} in a model reply; reasoning models may wrap JSON in prose or <think> blocks. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function alemOnce(model: string, key: string, call: JsonCall<unknown>): Promise<unknown> {
  const base = (process.env.ALEM_BASE_URL || "https://llm.alem.ai/v1").replace(/\/$/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), call.timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: call.maxTokens,
        messages: [
          {
            role: "system",
            content: `${call.system}\n\nReply with ONE JSON object only, no prose, matching this JSON Schema:\n${JSON.stringify(call.schema)}`,
          },
          { role: "user", content: call.user },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`alem ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

async function viaAlem<T>(call: JsonCall<T>): Promise<JsonResult<T> | null> {
  const key = process.env.ALEM_API_KEY;
  if (!key) return null;
  const primary = call.alemModel ?? (process.env.ALEM_MODEL || "alemllm");
  const plan: { model: string; key: string }[] = [
    { model: primary, key },
    { model: primary, key }, // one retry on invalid output
  ];
  if (!call.alemModel) plan.push({ model: process.env.ALEM_FALLBACK_MODEL || "gpt-oss", key: process.env.ALEM_FALLBACK_API_KEY || key });
  for (const step of plan) {
    try {
      const v = await alemOnce(step.model, step.key, call as JsonCall<unknown>);
      if (call.validate(v)) return { ok: true, value: v, provider: "alem", model: step.model };
    } catch (e) {
      console.error("alem call failed", step.model, e instanceof Error ? e.message : "error");
    }
  }
  return { ok: false, reason: "alem_invalid" };
}

async function viaAnthropic<T>(call: JsonCall<T>): Promise<JsonResult<T> | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ timeout: call.timeoutMs, maxRetries: 0 });
  try {
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: call.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: call.schema } },
      system: call.system,
      messages: [{ role: "user", content: call.user }],
    });
    if (msg.stop_reason === "refusal") return { ok: false, reason: "refusal" };
    const text = msg.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
    const v = extractJson(text);
    return call.validate(v) ? { ok: true, value: v, provider: "anthropic", model: "claude-opus-5-5" } : { ok: false, reason: "invalid" };
  } catch (err) {
    console.error("anthropic call failed", err instanceof Anthropic.APIError ? err.status : "network");
    return { ok: false, reason: "anthropic_error" };
  }
}

export async function completeJson<T>(call: JsonCall<T>): Promise<JsonResult<T>> {
  const a = await viaAlem(call);
  if (a?.ok) return a;
  if (call.alemModel) return a ?? { ok: false, reason: "no_alem_key" };
  const b = await viaAnthropic(call);
  if (b?.ok) return b;
  return { ok: false, reason: a?.ok === false ? a.reason : b?.ok === false ? b.reason : "no_provider" };
}
