import { detectDisqualifiers, runSearch } from "@/lib/ranking";
import { getCandidate } from "@/lib/data/candidates";
import type { Icp } from "@/lib/types";

export function rubricRank(icp: Icp): string[] {
  return runSearch(icp, 36).map((r) => r.candidateId);
}

export function disqualifyIds(icp: Icp, ids: string[]): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const c = getCandidate(id);
    if (!c) continue;
    if (detectDisqualifiers(c, icp).length > 0) out.add(id);
  }
  return out;
}
