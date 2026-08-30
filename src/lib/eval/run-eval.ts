import { GOLDEN_SETS } from "@/lib/eval/golden";
import { ndcgAt, precisionAt, recall } from "@/lib/eval/metrics";
import { naiveRank } from "@/lib/scoring/naive";
import { disqualifyIds, rubricRank } from "@/lib/scoring/rubric";
import { MODEL_VERSIONS, PROMPT_VERSIONS } from "../../../prompts/versions.ts";

export type EvalReport = {
  modelVersion: string;
  promptVersion: string;
  ndcg10: number;
  pAt5: number;
  disqualifierRecall: number;
  rubricPAt5: number;
  naivePAt5: number;
  passed: boolean;
  notes: string;
  perSet: {
    id: string;
    ndcg10: number;
    pAt5: number;
    disqualifierRecall: number;
  }[];
};

const P5_FLOOR = 0.5;
const P5_TOLERANCE = 0.05;

export function runEvalSuite(): EvalReport {
  const perSet = GOLDEN_SETS.map((set) => {
    const relevant = new Map(set.judgments.map((j) => [j.candidateId, 4 - Math.min(3, j.humanRank - 1)]));
    const relevantIds = new Set(set.judgments.map((j) => j.candidateId));
    const predicted = rubricRank(set.icp);
    const naive = naiveRank(set.briefText);
    const dq = disqualifyIds(set.icp, set.shouldDisqualify.concat(predicted));
    return {
      id: set.id,
      ndcg10: ndcgAt(predicted, relevant, 10),
      pAt5: precisionAt(predicted, relevantIds, 5),
      naivePAt5: precisionAt(naive, relevantIds, 5),
      disqualifierRecall: recall(dq, new Set(set.shouldDisqualify)),
    };
  });

  const avg = (key: "ndcg10" | "pAt5" | "disqualifierRecall" | "naivePAt5") =>
    perSet.reduce((s, r) => s + r[key], 0) / perSet.length;

  const rubricPAt5 = avg("pAt5");
  const naivePAt5 = avg("naivePAt5");
  const beatsNaive = rubricPAt5 + 1e-9 >= naivePAt5;
  const aboveFloor = rubricPAt5 + 1e-9 >= P5_FLOOR - P5_TOLERANCE;
  const passed = beatsNaive && aboveFloor;

  let notes = "";
  if (!beatsNaive) {
    notes =
      "THESIS MISS: rubric+case-for/against did not beat the naive JD-overlap ranker on P@5. Stop and raise this — the product bet depends on it.";
  } else if (!aboveFloor) {
    notes = `P@5 ${rubricPAt5.toFixed(3)} below floor ${P5_FLOOR}.`;
  } else {
    notes = `Rubric P@5 ${rubricPAt5.toFixed(3)} beat naive ${naivePAt5.toFixed(3)}.`;
  }

  return {
    modelVersion: MODEL_VERSIONS.heuristic,
    promptVersion: PROMPT_VERSIONS.gradeRubric,
    ndcg10: avg("ndcg10"),
    pAt5: rubricPAt5,
    disqualifierRecall: avg("disqualifierRecall"),
    rubricPAt5,
    naivePAt5,
    passed,
    notes,
    perSet: perSet.map(({ id, ndcg10, pAt5, disqualifierRecall }) => ({
      id,
      ndcg10,
      pAt5,
      disqualifierRecall,
    })),
  };
}
