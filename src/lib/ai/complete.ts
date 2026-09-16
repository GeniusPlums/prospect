import { Langfuse } from "langfuse";
import { connectionsForRole, executeIntent, pickToolSlug } from "@/lib/composio/client";
import { ROLE_NEEDLES } from "@/lib/composio/catalog";
import { extractChatText } from "@/lib/composio/parse";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const MODEL_TRIES = [DEFAULT_MODEL, "gpt-4o-mini", "gpt-4o", "llama-3.3-70b-versatile"];

function langfuse() {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secretKey || !publicKey) return null;
  return new Langfuse({
    secretKey,
    publicKey,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
  });
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

async function groqFallback(input: {
  name: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ ok: true; text: string; via: "groq" } | { ok: false; error: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: "No LLM connected. Connect one on Connections." };

  const lf = langfuse();
  const trace = lf?.trace({ name: input.name, metadata: { model: DEFAULT_MODEL, via: "env-groq-fallback" } });
  const started = Date.now();

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1200,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    const body = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!res.ok) {
      const error = body.error?.message ?? `Groq HTTP ${res.status}`;
      trace?.update({ output: error, metadata: { status: res.status } });
      return { ok: false, error };
    }
    const text = body.choices?.[0]?.message?.content ?? "";
    trace?.generation({
      name: input.name,
      model: DEFAULT_MODEL,
      input: { system: input.system, user: input.user.slice(0, 4000) },
      output: text.slice(0, 4000),
      usage: {
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
      },
      metadata: { ms: Date.now() - started },
    });
    return { ok: true, text, via: "groq" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Groq request failed";
    trace?.update({ output: error });
    return { ok: false, error };
  } finally {
    await lf?.flushAsync().catch(() => undefined);
  }
}

export async function completeJson(input: {
  name: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  orgId?: string;
}): Promise<{ ok: true; text: string; via: string } | { ok: false; error: string }> {
  const messages = [
    { role: "system", content: input.system },
    { role: "user", content: input.user },
  ];

  if (input.orgId) {
    const connections = await connectionsForRole(input.orgId, "llm");
    for (const connection of connections) {
      const slug = await pickToolSlug(connection.toolkit, ROLE_NEEDLES.llm);
      if (!slug) continue;
      for (const model of MODEL_TRIES) {
        const result = await executeIntent({
          orgId: input.orgId,
          toolkit: connection.toolkit,
          connectedAccountId: connection.connected_account_id,
          needles: ["chat", "completion"],
          arguments: {
            model,
            messages,
            temperature: input.temperature ?? 0.2,
            max_tokens: input.maxTokens ?? 1200,
            max_completion_tokens: input.maxTokens ?? 1200,
          },
        });
        if (result.successful === false) continue;
        const text = extractChatText(result.data);
        if (text) return { ok: true, text, via: connection.toolkit };
      }
    }
  }

  return groqFallback(input);
}
