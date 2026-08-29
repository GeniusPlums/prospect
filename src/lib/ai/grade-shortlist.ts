import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCandidate } from "@/lib/data/candidates";
import { candidateSummaryForLlm, narrate } from "@/lib/ranking";
import type { GradedCandidate, Icp, Verdict } from "@/lib/types";

const GradeSchema = z.object({
  grades: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["strong", "mixed", "weak", "flagged"]),
      caseFor: z.string(),
      caseAgainst: z.string(),
      unclear: z.array(z.string()),
      reviewerObjections: z.array(
        z.object({
          claim: z.string(),
          objection: z.string(),
        }),
      ),
    }),
  ),
});

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

export const gradeShortlist = createServerFn({ method: "POST" })
  .validator((input: { icp: Icp; candidateIds: string[] }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; grades: Record<string, Partial<GradedCandidate>> } | { ok: false; error: string }> => {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) return { ok: false, error: "AI is not available" };

      const people = data.candidateIds
        .slice(0, 10)
        .map((id) => getCandidate(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      if (people.length === 0) return { ok: false, error: "No candidates to grade" };

      const icp = data.icp;
      const dossier = people.map(candidateSummaryForLlm).join("\n\n---\n\n");

      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.3,
          max_tokens: 3500,
          messages: [
            {
              role: "system",
              content:
                "You are the grading agent for Prospect, an India-first recruiting product. You write a case for, a case against, an unclear band, and a reviewer-agent objection for each candidate. Rubric not scores. Company vintage matters: judge the company as it was when they joined, not as it is today. Services shops (TCS, Infosys, Wipro, Cognizant) are a weak product signal. Return JSON only: { grades: [{ id, verdict, caseFor, caseAgainst, unclear[], reviewerObjections: [{ claim, objection }] }] }. verdict is strong|mixed|weak|flagged. Be specific and use dossier facts. Never invent employers, talks, or repos.",
            },
            {
              role: "user",
              content: `ICP\n${JSON.stringify(icp, null, 2)}\n\nCANDIDATES\n${dossier}`,
            },
          ],
        }),
      });

      if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };

      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const text = body.choices[0]?.message.content ?? "";

      try {
        const parsed = GradeSchema.parse(extractJson(text));
        const grades: Record<string, Partial<GradedCandidate>> = {};
        for (const g of parsed.grades) {
          grades[g.id] = {
            verdict: g.verdict as Verdict,
            caseFor: g.caseFor,
            caseAgainst: g.caseAgainst,
            unclear: g.unclear,
            reviewerObjections: g.reviewerObjections,
          };
        }
        return { ok: true, grades };
      } catch {
        const fallback: Record<string, Partial<GradedCandidate>> = {};
        for (const person of people) {
          fallback[person.id] = narrate(person, icp);
        }
        return { ok: true, grades: fallback };
      }
    },
  );
