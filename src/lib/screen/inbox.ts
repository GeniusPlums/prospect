import { sql } from "@/lib/db";
import { nid } from "@/lib/ids";
import { getIcp } from "@/lib/icp/engine";
import { gradeCandidate } from "@/lib/scoring/grade-candidate";
import { candidates } from "@/lib/data/candidates";

export async function screenResume(input: {
  orgId: string;
  icpVersionId: string;
  resumeText: string;
}) {
  const icp = await getIcp(input.icpVersionId);
  if (!icp) throw new Error("ICP not found");
  const lower = input.resumeText.toLowerCase();
  const match = candidates.find((c) => lower.includes(c.name.toLowerCase()) || lower.includes(c.id));
  const candidateId = match?.id ?? null;
  const appId = nid("app");
  await sql(
    `INSERT INTO application (id, org_id, icp_version_id, candidate_id, resume_text, source)
     VALUES ($1,$2,$3,$4,$5,'inbound')`,
    [appId, input.orgId, input.icpVersionId, candidateId, input.resumeText],
  );
  const graded = candidateId ? gradeCandidate(candidateId, icp) : null;
  return {
    appId,
    candidateId,
    verdict: graded?.verdict ?? null,
    caseFor: graded?.caseFor ?? null,
    caseAgainst: graded?.caseAgainst ?? null,
  };
}
