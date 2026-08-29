import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CompanyKind, Icp, Seniority } from "@/lib/types";

const IcpSchema = z.object({
  title: z.string(),
  summary: z.string(),
  must: z.array(z.string()),
  nice: z.array(z.string()),
  disqualifiers: z.array(z.string()),
  locations: z.array(z.string()),
  seniority: z.enum(["mid", "senior", "staff", "founding", "em"]),
  yearsMin: z.number(),
  yearsMax: z.number(),
  companyKinds: z.array(
    z.enum(["fintech", "saas", "consumer", "faang", "services", "startup"]),
  ),
  skills: z.array(z.string()),
});

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

export const parseBrief = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; icp: Icp } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI is not available in this environment" };

    const brief = data.text.trim().slice(0, 6000);
    if (brief.length < 20) return { ok: false, error: "Paste a fuller brief — a title alone is not enough." };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You turn job descriptions into a structured ideal-candidate profile for an Indian hiring market. Return JSON only. companyKinds subset of fintech|saas|consumer|faang|services|startup. seniority one of mid|senior|staff|founding|em. Keep must/nice/disqualifiers short and specific. India-first: prefer city names (Bengaluru, Hyderabad, Pune, Gurugram) over 'remote'. Do not invent requirements that are not in the brief.",
          },
          {
            role: "user",
            content: `Parse this brief into JSON with keys: title, summary, must[], nice[], disqualifiers[], locations[], seniority, yearsMin, yearsMax, companyKinds[], skills[].\n\n${brief}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `xAI API error ${res.status}` };
    }

    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = body.choices[0]?.message.content ?? "";
    try {
      const parsed = IcpSchema.parse(extractJson(text));
      return {
        ok: true,
        icp: {
          ...parsed,
          seniority: parsed.seniority as Seniority,
          companyKinds: parsed.companyKinds as CompanyKind[],
        },
      };
    } catch {
      return { ok: false, error: "Could not read a structured profile from the model. Try a sample role." };
    }
  });
