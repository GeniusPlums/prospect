import { getCandidate } from "@/lib/data/candidates";
import { detectDisqualifiers, narrate } from "@/lib/ranking";
import type { Icp, Verdict } from "@/lib/types";

export type RubricGrade = "strong_yes" | "yes" | "unclear" | "no" | "strong_no";

function gradeMust(held: boolean, stuffed: boolean): RubricGrade {
  if (stuffed) return "no";
  return held ? "yes" : "no";
}

export function gradeFromText(input: {
  displayName: string;
  headline: string;
  city: string;
  hay: string;
  icp: Icp;
}) {
  const hay = input.hay.toLowerCase();
  const mustGrades = input.icp.must.map((m, i) => {
    const held = hay.includes(m.slice(0, 8).toLowerCase());
    return {
      criterionId: `must-${i}`,
      grade: gradeMust(held, false),
      evidence: held ? input.headline.slice(0, 180) : `${input.displayName} does not show ${m}`,
    };
  });
  const yes = mustGrades.filter((g) => g.grade === "yes" || g.grade === "strong_yes").length;
  const no = mustGrades.filter((g) => g.grade === "no" || g.grade === "strong_no").length;
  const unclear = input.icp.nice.filter((n) => !hay.includes(n.slice(0, 8).toLowerCase()));
  const total = Math.max(1, yes + no + unclear.length);
  return {
    caseFor: input.headline || `${input.displayName} in ${input.city}`,
    caseAgainst: no ? "Collected profile is thin versus the ICP musts." : "Limited dossier versus the stated musts.",
    unclear,
    forWeight: yes / total,
    againstWeight: no / total,
    unclearWeight: unclear.length / total,
    verdict: (yes >= no ? "mixed" : "weak") as Verdict,
    disqualified: false,
    disqualifierFlags: [] as { flag: string }[],
    criterionGrades: mustGrades,
    reviewerObjections: [
      {
        claim: "Collected profile",
        objection: "This person was graded from a collected or cached dossier. Treat evidence as incomplete until reveal.",
      },
    ],
  };
}

export function gradeCandidate(candidateId: string, icp: Icp) {
  const candidate = getCandidate(candidateId);
  if (!candidate) return null;
  const narrative = narrate(candidate, icp);
  const flags = detectDisqualifiers(candidate, icp);
  const mustGrades = icp.must.map((m, i) => {
    const held = narrative.caseFor.toLowerCase().includes(m.slice(0, 8).toLowerCase()) || candidate.skills.some((s) => m.toLowerCase().includes(s.toLowerCase()));
    return { criterionId: `must-${i}`, grade: gradeMust(held, candidate.stuffed), evidence: held ? narrative.caseFor.slice(0, 180) : narrative.caseAgainst.slice(0, 180) };
  });
  const yes = mustGrades.filter((g) => g.grade === "yes" || g.grade === "strong_yes").length;
  const no = mustGrades.filter((g) => g.grade === "no" || g.grade === "strong_no").length;
  const unclear = narrative.unclear.length;
  const total = Math.max(1, yes + no + unclear);
  return {
    caseFor: narrative.caseFor,
    caseAgainst: narrative.caseAgainst,
    unclear: narrative.unclear,
    forWeight: yes / total,
    againstWeight: no / total,
    unclearWeight: unclear / total,
    verdict: flags.length ? "flagged" : yes >= no ? "strong" : "mixed",
    disqualified: flags.some((f) => f.flag !== "Location"),
    disqualifierFlags: flags,
    criterionGrades: mustGrades,
    reviewerObjections: narrative.reviewerObjections,
  };
}
