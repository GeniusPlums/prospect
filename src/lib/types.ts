export type CompanyKind =
  | "fintech"
  | "saas"
  | "consumer"
  | "faang"
  | "services"
  | "startup";

export type Seniority = "mid" | "senior" | "staff" | "founding" | "em";

export type TenurePattern = "stable" | "hopper" | "long-stayer";

export type VisaStatus = "india" | "needs-h1b" | "us-bound";

export type Verdict = "strong" | "mixed" | "weak" | "flagged";

export type CompanySnapshot = {
  year: number;
  stage: string;
  headcount: number;
  signal: string;
};

export type Company = {
  id: string;
  name: string;
  kind: CompanyKind;
  city: string;
  snapshots: CompanySnapshot[];
};

export type Role = {
  companyId: string;
  title: string;
  start: number;
  end: number | null;
  scope: string;
};

export type GithubRepo = {
  name: string;
  stars: number;
  description: string;
};

export type GithubProfile = {
  handle: string;
  contributions12m: number;
  languages: string[];
  repos: GithubRepo[];
};

export type Talk = {
  title: string;
  venue: string;
  year: number;
};

export type Writing = {
  title: string;
  year: number;
};

export type Education = {
  school: string;
  degree: string;
};

export type Candidate = {
  id: string;
  name: string;
  headline: string;
  city: string;
  years: number;
  history: Role[];
  skills: string[];
  github: GithubProfile | null;
  talks: Talk[];
  writing: Writing[];
  education: Education;
  noticePeriodDays: number;
  visa: VisaStatus;
  expectedLpa?: number;
  stuffed: boolean;
  tenure: TenurePattern;
};

export type Icp = {
  title: string;
  summary: string;
  must: string[];
  nice: string[];
  disqualifiers: string[];
  locations: string[];
  seniority: Seniority;
  yearsMin: number;
  yearsMax: number;
  companyKinds: CompanyKind[];
  skills: string[];
};

export type DisqualifierFlag = {
  flag: string;
  detail: string;
};

export type ReviewerObjection = {
  claim: string;
  objection: string;
};

export type GradedCandidate = {
  candidateId: string;
  rank: number;
  verdict: Verdict;
  caseFor: string;
  caseAgainst: string;
  unclear: string[];
  disqualifiers: DisqualifierFlag[];
  reviewerObjections: ReviewerObjection[];
  score: number;
};

export type FeedbackVote = {
  vote: "up" | "down";
  tags: string[];
};

export type SearchStatus = "running" | "done";

export type OutreachVia = "gmail" | "outlook" | "mail-app";

export type SentOutreach = {
  to: string;
  subject: string;
  at: number;
  via?: OutreachVia;
};

export type SearchRun = {
  id: string;
  createdAt: number;
  briefText: string;
  icp: Icp;
  sampleId?: string;
  status: SearchStatus;
  results: GradedCandidate[];
  revealed: string[];
  outreach: Record<string, string>;
  sent: Record<string, SentOutreach>;
  feedback: Record<string, FeedbackVote>;
  pendingIcpDiff?: {
    addMust: string[];
    addDisqualifiers: string[];
    note: string;
  };
};

export type SampleBrief = {
  id: string;
  label: string;
  blurb: string;
  jd: string;
  icp: Icp;
};
