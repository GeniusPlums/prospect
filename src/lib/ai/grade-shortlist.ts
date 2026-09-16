import { createServerFn } from "@tanstack/react-start";
import { requireOrg } from "@/lib/auth/session";
import { gradeDossiers } from "@/lib/ai/grade-dossiers";
import { loadDossiers } from "@/lib/index/corpus";
import { DEV_ORG } from "@/lib/ids";
import type { GradedCandidate, Icp } from "@/lib/types";

export const gradeShortlist = createServerFn({ method: "POST" })
  .validator((input: { icp: Icp; candidateIds: string[] }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; grades: Record<string, Partial<GradedCandidate>> } | { ok: false; error: string }> => {
      const session = await requireOrg().catch(() => null);
      const dossiers = await loadDossiers(data.candidateIds.slice(0, 10));
      if (dossiers.length === 0) return { ok: false, error: "No candidates to grade" };
      const graded = await gradeDossiers({
        orgId: session?.orgId ?? DEV_ORG,
        icp: data.icp,
        dossiers,
        useLlm: Boolean(session?.orgId && session.orgId !== DEV_ORG),
      });
      const grades: Record<string, Partial<GradedCandidate>> = {};
      for (const [id, row] of graded) {
        grades[id] = {
          verdict: row.verdict,
          caseFor: row.caseFor,
          caseAgainst: row.caseAgainst,
          unclear: row.unclear,
          reviewerObjections: row.reviewerObjections,
        };
      }
      return { ok: true, grades };
    },
  );
