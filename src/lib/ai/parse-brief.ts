import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { completeJson, extractJson } from "@/lib/ai/complete";
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

export const parseBrief = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; icp: Icp } | { ok: false; error: string }> => {
    const brief = data.text.trim().slice(0, 6000);
    if (brief.length < 20) return { ok: false, error: "Paste a fuller brief — a title alone is not enough." };

    const result = await completeJson({
      name: "parse-brief",
      temperature: 0.2,
      maxTokens: 1200,
      system:
        "You turn job descriptions into a structured ideal-candidate profile for an Indian hiring market. Return JSON only. companyKinds subset of fintech|saas|consumer|faang|services|startup. seniority one of mid|senior|staff|founding|em. Keep must/nice/disqualifiers short and specific. India-first: prefer city names (Bengaluru, Hyderabad, Pune, Gurugram) over 'remote'. Do not invent requirements that are not in the brief.",
      user: `Parse this brief into JSON with keys: title, summary, must[], nice[], disqualifiers[], locations[], seniority, yearsMin, yearsMax, companyKinds[], skills[].\n\n${brief}`,
    });
    if (!result.ok) return { ok: false, error: result.error };

    try {
      const parsed = IcpSchema.parse(extractJson(result.text));
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
