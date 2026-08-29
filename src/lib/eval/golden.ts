import { candidates } from "@/lib/data/candidates";
import { sampleBriefs } from "@/lib/data/sample-briefs";
import type { Icp } from "@/lib/types";

export type FrozenJudgment = {
  candidateId: string;
  humanRank: number;
  relevant: boolean;
};

export type FrozenSet = {
  id: string;
  name: string;
  briefText: string;
  icp: Icp;
  judgments: FrozenJudgment[];
  shouldDisqualify: string[];
};

function ranks(ids: string[]): FrozenJudgment[] {
  return ids.map((candidateId, i) => ({
    candidateId,
    humanRank: i + 1,
    relevant: true,
  }));
}

export const GOLDEN_SETS: FrozenSet[] = [
  {
    id: "payments-backend",
    name: sampleBriefs[0]!.label,
    briefText: sampleBriefs[0]!.jd,
    icp: sampleBriefs[0]!.icp,
    judgments: ranks([
      "aditya-iyer",
      "nandini-rao",
      "aisha-khan",
      "karthik-menon",
      "deepika-menon",
      "gautam-pillai",
      "rohan-deshpande",
      "tanvi-chawla",
    ]),
    shouldDisqualify: ["vikram-shah", "mohit-agarwal", "ravi-chandra", "amit-kulkarni", "nikhil-sharma"],
  },
  {
    id: "founding-engineer",
    name: sampleBriefs[1]!.label,
    briefText: sampleBriefs[1]!.jd,
    icp: sampleBriefs[1]!.icp,
    judgments: ranks([
      "varun-iyer",
      "omar-farooq",
      "kabir-singh",
      "yashwant-rao",
      "divya-reddy",
      "farhan-qureshi",
      "pooja-jain",
      "lakshmi-narayanan",
    ]),
    shouldDisqualify: ["sanjay-bansal", "nikhil-sharma", "kiran-shetty", "mohit-agarwal"],
  },
  {
    id: "staff-frontend",
    name: sampleBriefs[2]!.label,
    briefText: sampleBriefs[2]!.jd,
    icp: sampleBriefs[2]!.icp,
    judgments: ranks([
      "tara-fernandes",
      "shreya-iyer",
      "rhea-dsouza",
      "meera-nair",
      "farhan-qureshi",
      "divya-reddy",
    ]),
    shouldDisqualify: ["vikram-shah", "mohit-agarwal"],
  },
  {
    id: "ml-ranking",
    name: sampleBriefs[3]!.label,
    briefText: sampleBriefs[3]!.jd,
    icp: sampleBriefs[3]!.icp,
    judgments: ranks(["leela-krishnan", "sanjay-bansal", "priya-venkatesh", "neha-kamat", "harsh-patel"]),
    shouldDisqualify: ["vikram-shah", "sanjay-bansal"],
  },
];

export const ALL_CANDIDATE_IDS = candidates.map((c) => c.id);
