export function dcg(rels: number[]): number {
  return rels.reduce((sum, rel, i) => sum + (Math.pow(2, rel) - 1) / Math.log2(i + 2), 0);
}

export function ndcgAt(predictedIds: string[], relevant: Map<string, number>, k: number): number {
  const pred = predictedIds.slice(0, k).map((id) => relevant.get(id) ?? 0);
  const ideal = [...relevant.values()].sort((a, b) => b - a).slice(0, k);
  const denom = dcg(ideal);
  if (denom === 0) return 0;
  return dcg(pred) / denom;
}

export function precisionAt(predictedIds: string[], relevantIds: Set<string>, k: number): number {
  const slice = predictedIds.slice(0, k);
  if (slice.length === 0) return 0;
  return slice.filter((id) => relevantIds.has(id)).length / k;
}

export function recall(
  predictedPositive: Set<string>,
  goldPositive: Set<string>,
): number {
  if (goldPositive.size === 0) return 1;
  let hit = 0;
  for (const id of goldPositive) if (predictedPositive.has(id)) hit += 1;
  return hit / goldPositive.size;
}
