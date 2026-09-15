import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { completeJson, extractJson } from "@/lib/ai/complete";
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

export const gradeShortlist = createServerFn({ method: "POST" })
  .validator((input: { icp: Icp; candidateIds: string[] }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; grades: Record<string, Partial<GradedCandidate>> } | { ok: false; error: string }> => {
      const people = data.candidateIds
        .slice(0, 10)
        .map((id) => getCandidate(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      if (people.length === 0) return { ok: false, error: "No candidates to grade" };

      const icp = data.icp;
      const dossier = people.map(candidateSummaryForLlm).join("\n\n---\n\n");
      const result = await completeJson({
        name: "grade-shortlist",
        temperature: 0.3,
        maxTokens: 3500,
        system:
          "You are the grading agent for Prospect, an India-first recruiting product. You write a case for, a case against, an unclear band, and a reviewer-agent objection for each candidate. Rubric not scores. Company vintage matters: judge the company as it was when they joined, not as it is today. Services shops (TCS, Infosys, Wipro, Cognizant) are a weak product signal. Return JSON only: { grades: [{ id, verdict, caseFor, caseAgainst, unclear[], reviewerObjections: [{ claim, objection }] }] }. verdict is strong|mixed|weak|flagged. Be specific and use dossier facts. Never invent employers, talks, or repos.",
        user: `ICP\n${JSON.stringify(icp, null, 2)}\n\nCANDIDATES\n${dossier}`,
      });

      if (!result.ok) {
        const fallback: Record<string, Partial<GradedCandidate>> = {};
        for (const person of people) fallback[person.id] = narrate(person, icp);
        return { ok: true, grades: fallback };
      }

      try {
        const parsed = GradeSchema.parse(extractJson(result.text));
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
        for (const person of people) fallback[person.id] = narrate(person, icp);
        return { ok: true, grades: fallback };
      }
    },
  );
