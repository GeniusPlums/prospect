import { completeJson, extractJson } from "@/lib/ai/complete";
import { gradeFromText } from "@/lib/scoring/grade-candidate";
import type { StoredDossier } from "@/lib/index/corpus";
import type { Icp, Verdict } from "@/lib/types";
import { z } from "zod";

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

export type DossierGrade = ReturnType<typeof gradeFromText> & { modelVersion: string };

function heuristic(dossier: StoredDossier, icp: Icp): DossierGrade {
  return { ...gradeFromText({ displayName: dossier.displayName, headline: dossier.headline, city: dossier.city, hay: dossier.hay, icp }), modelVersion: "heuristic.v1" };
}

function dossierBlurb(dossier: StoredDossier): string {
  return `id=${dossier.id}\nname=${dossier.displayName}\nheadline=${dossier.headline}\ncity=${dossier.city}\nyears=${dossier.years}\n${dossier.hay.slice(0, 1200)}`;
}

export async function gradeDossiers(input: {
  orgId: string;
  icp: Icp;
  dossiers: StoredDossier[];
  useLlm: boolean;
}): Promise<Map<string, DossierGrade>> {
  const out = new Map<string, DossierGrade>();
  for (const dossier of input.dossiers) out.set(dossier.id, heuristic(dossier, input.icp));
  if (!input.useLlm || input.dossiers.length === 0) return out;

  const batches: StoredDossier[][] = [];
  for (let i = 0; i < input.dossiers.length; i += 8) {
    batches.push(input.dossiers.slice(i, i + 8));
  }

  for (const batch of batches) {
    const result = await completeJson({
      name: "grade-shortlist",
      orgId: input.orgId,
      temperature: 0.3,
      maxTokens: 3500,
      system:
        "You grade recruiting shortlist dossiers. Write a case for, a case against, unclear items, and a reviewer objection for each person. Rubric not scores. Never invent employers, talks, emails, or repos. Return JSON only: { grades: [{ id, verdict, caseFor, caseAgainst, unclear[], reviewerObjections: [{ claim, objection }] }] }. verdict is strong|mixed|weak|flagged. Use only facts in the dossier.",
      user: `ICP\n${JSON.stringify({ title: input.icp.title, must: input.icp.must, nice: input.icp.nice, disqualifiers: input.icp.disqualifiers, locations: input.icp.locations, skills: input.icp.skills })}\n\nCANDIDATES\n${batch.map(dossierBlurb).join("\n\n---\n\n")}`,
    });
    if (!result.ok) continue;
    try {
      const parsed = GradeSchema.parse(extractJson(result.text));
      for (const grade of parsed.grades) {
        const prior = out.get(grade.id);
        if (!prior) continue;
        out.set(grade.id, {
          ...prior,
          caseFor: grade.caseFor,
          caseAgainst: grade.caseAgainst,
          unclear: grade.unclear,
          verdict: grade.verdict as Verdict,
          reviewerObjections: grade.reviewerObjections.length
            ? grade.reviewerObjections
            : prior.reviewerObjections,
          modelVersion: "connected-llm",
        });
      }
    } catch {
      /* keep heuristic for this batch */
    }
  }
  return out;
}
