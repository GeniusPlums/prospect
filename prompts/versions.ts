export const PROMPT_VERSIONS = {
  parseIcp: "parse-icp.v1",
  gradeRubric: "grade-rubric.v1",
  disqualifier: "disqualifier.v1",
  reviewer: "reviewer.v1",
  naiveRank: "naive-rank.v1",
} as const;

export const MODEL_VERSIONS = {
  haiku: "claude-haiku-local",
  sonnet: "claude-sonnet-local",
  heuristic: "heuristic.v1",
} as const;
