import { candidates, getCandidate, currentRole } from "@/lib/data/candidates";
import { getCompany, snapshotAt } from "@/lib/data/companies";
import type {
  Candidate,
  CompanyKind,
  DisqualifierFlag,
  GradedCandidate,
  Icp,
  ReviewerObjection,
  Role,
  Seniority,
  Verdict,
} from "@/lib/types";
import { hashString, yearRange } from "@/lib/utils";

const KIND_SCORE: Record<CompanyKind, number> = {
  fintech: 10,
  saas: 8,
  startup: 9,
  consumer: 7,
  faang: 6,
  services: 1,
};

const VINTAGE_BONUS: Record<string, number> = {
  razorpay: 2019,
  phonepe: 2018,
  cred: 2019,
  groww: 2020,
  cashfree: 2017,
  hasura: 2020,
  postman: 2019,
  zerodha: 2018,
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+/# ]/g, " ").replace(/\s+/g, " ").trim();
}

function haystack(candidate: Candidate): string {
  const companies = candidate.history.map((r) => getCompany(r.companyId));
  const kinds = companies.map((c) => c.kind).join(" ");
  const product = companies.some((c) => c.kind !== "services") ? "product-company product company" : "";
  return normalize(
    [
      candidate.headline,
      candidate.city,
      `${candidate.years} years backend`,
      candidate.skills.join(" "),
      candidate.history.map((r) => `${r.title} ${r.scope}`).join(" "),
      companies.map((c) => c.name).join(" "),
      kinds,
      product,
      candidate.talks.map((t) => t.title).join(" "),
      candidate.writing.map((w) => w.title).join(" "),
      candidate.github?.languages.join(" ") ?? "",
    ].join(" "),
  );
}

function tokenMatch(hay: string, needle: string): boolean {
  const n = normalize(needle);
  if (!n) return false;
  if (n.includes(" or ")) {
    return n.split(" or ").some((part) => tokenMatch(hay, part));
  }
  if (hay.includes(n)) return true;
  const parts = n.split(" ").filter((p) => p.length > 2);
  if (parts.length === 0) return false;
  const hits = parts.filter((p) => hay.includes(p));
  return hits.length >= Math.min(2, parts.length) || (parts.length === 1 && hits.length === 1);
}

function mustHeld(candidate: Candidate, must: string, icp: Icp): boolean {
  const n = normalize(must);
  if (/year/.test(n)) {
    return candidate.years >= icp.yearsMin - 1 && candidate.years <= icp.yearsMax + 2;
  }
  if (icp.locations.some((l) => n.includes(normalize(l)) || normalize(l).includes(n))) {
    return locationFit(candidate.city, icp.locations) >= 0;
  }
  if (n.includes("product") && n.includes("compan")) {
    return candidate.history.some((r) => getCompany(r.companyId).kind !== "services");
  }
  return tokenMatch(haystack(candidate), must);
}

function kindFit(candidate: Candidate, icp: Icp): number {
  const kinds = candidate.history.map((r) => getCompany(r.companyId).kind);
  const preferred = new Set(icp.companyKinds);
  const current = kinds[0];
  if (current && preferred.has(current)) return 8;
  if (kinds.some((k) => preferred.has(k))) return 4;
  if (current === "services") return -8;
  return 0;
}

function vintageBonus(candidate: Candidate): number {
  let bonus = 0;
  for (const role of candidate.history) {
    const target = VINTAGE_BONUS[role.companyId];
    if (target && role.start <= target + 1) bonus += 6;
  }
  return bonus;
}

function seniorityFit(years: number, seniority: Seniority): number {
  const bands: Record<Seniority, [number, number]> = {
    mid: [3, 6],
    senior: [5, 9],
    staff: [8, 14],
    founding: [4, 9],
    em: [10, 18],
  };
  const [lo, hi] = bands[seniority];
  if (years >= lo && years <= hi) return 6;
  if (years < lo - 2 || years > hi + 3) return -6;
  return 0;
}

function locationFit(city: string, locations: string[]): number {
  if (locations.length === 0) return 0;
  const c = city.toLowerCase();
  if (locations.some((l) => l.toLowerCase().includes(c) || c.includes(l.toLowerCase()))) {
    return 5;
  }
  if (locations.some((l) => l.toLowerCase().includes("india") || l.toLowerCase().includes("remote"))) {
    return 2;
  }
  return -4;
}

export function scoreCandidate(candidate: Candidate, icp: Icp): number {
  const hay = haystack(candidate);
  let score = 40;

  for (const must of icp.must) {
    score += mustHeld(candidate, must, icp) ? 8 : -6;
  }
  for (const nice of icp.nice) {
    if (tokenMatch(hay, nice)) score += 4;
  }
  for (const skill of icp.skills) {
    if (tokenMatch(hay, skill)) score += 3;
  }
  const skillHits = icp.skills.filter((s) => tokenMatch(hay, s)).length;
  if (icp.skills.length > 0 && skillHits === 0) score -= 12;

  if (candidate.years >= icp.yearsMin && candidate.years <= icp.yearsMax) score += 6;
  else if (candidate.years < icp.yearsMin - 2 || candidate.years > icp.yearsMax + 3) score -= 8;
  else score -= 2;

  score += seniorityFit(candidate.years, icp.seniority);
  score += locationFit(candidate.city, icp.locations);
  score += kindFit(candidate, icp);
  score += vintageBonus(candidate);

  const currentKind = getCompany(currentRole(candidate).companyId).kind;
  score += KIND_SCORE[currentKind] ?? 0;

  if (candidate.github) {
    score += Math.min(8, Math.round(candidate.github.contributions12m / 150));
    score += candidate.github.repos.length > 0 ? 3 : 0;
  } else {
    score -= 2;
  }
  if (candidate.talks.length) score += 4;
  if (candidate.writing.length) score += 3;
  if (candidate.tenure === "hopper" && icp.seniority !== "founding") score -= 3;
  if (candidate.stuffed) score -= 18;
  if (candidate.noticePeriodDays >= 90) score -= 6;
  if (candidate.visa === "us-bound") score -= 10;
  if (icp.seniority === "founding" && currentKind === "startup") score += 8;
  if (icp.seniority === "founding" && candidate.github && candidate.github.contributions12m > 800) {
    score += 6;
  }
  if (icp.seniority === "staff" && candidate.years < 8) score -= 8;
  if (icp.seniority !== "founding" && /founding/.test(hay)) {
    score -= 14;
  }
  if (icp.seniority === "founding" && !/founding|early|seed/.test(hay) && currentKind !== "startup") {
    score -= 10;
  }
  if (icp.skills.some((s) => s.toLowerCase().includes("design system"))) {
    if (hay.includes("design system")) score += 14;
    else score -= 16;
  }
  if (icp.skills.some((s) => s.toLowerCase().includes("ranking"))) {
    if (hay.includes("ranking") || hay.includes("recommend") || hay.includes("search")) score += 16;
    else score -= 22;
  }
  if (icp.skills.some((s) => s.toLowerCase() === "react") && icp.seniority === "staff") {
    if (!hay.includes("frontend") && !hay.includes("react") && !hay.includes("design system")) {
      score -= 14;
    }
  }

  // Tiny deterministic jitter so ties break stably without hydration drift.
  score += (hashString(candidate.id + icp.title) % 5) / 10;
  return score;
}

export function detectDisqualifiers(candidate: Candidate, icp: Icp): DisqualifierFlag[] {
  const flags: DisqualifierFlag[] = [];
  const current = getCompany(currentRole(candidate).companyId);

  if (candidate.stuffed) {
    flags.push({
      flag: "Keyword-stuffed profile",
      detail:
        "Skills list reads as a keyword dump. Almost no corroborating GitHub, talks, or scoped work.",
    });
  }
  if (candidate.noticePeriodDays >= 90 && icp.disqualifiers.some((d) => /90/.test(d))) {
    flags.push({
      flag: "90-day notice",
      detail: `${candidate.name.split(" ")[0]} is on a ${candidate.noticePeriodDays}-day notice. Buyout is possible; don't spend a reveal until that's confirmed.`,
    });
  }
  if (candidate.visa === "us-bound") {
    flags.push({
      flag: "US-bound",
      detail:
        "Signals point to an active US process. Outreach is likely to bounce or go cold in six weeks.",
    });
  }
  if (
    current.kind === "services" &&
    candidate.history.every((r) => getCompany(r.companyId).kind === "services")
  ) {
    flags.push({
      flag: "Services-only background",
      detail: `Entire history is ${current.name}. Title maps to billing, not product scope.`,
    });
  }
  if (icp.seniority !== "em" && currentRole(candidate).title.toLowerCase().includes("manager")) {
    flags.push({
      flag: "People manager",
      detail: "Current title is management. Last IC years need to be verified before this is an IC search.",
    });
  }
  if (
    icp.locations.length > 0 &&
    !icp.locations.some(
      (l) =>
        l.toLowerCase().includes(candidate.city.toLowerCase()) ||
        candidate.city.toLowerCase().includes(l.toLowerCase()) ||
        l.toLowerCase().includes("remote") ||
        l.toLowerCase().includes("india"),
    )
  ) {
    flags.push({
      flag: "Location",
      detail: `Based in ${candidate.city}. Brief is ${icp.locations.join(", ")}.`,
    });
  }
  if (
    icp.seniority === "founding" &&
    candidate.noticePeriodDays >= 60
  ) {
    flags.push({
      flag: "Notice too long for seed",
      detail: "Seed teams cannot wait 60 days. Immediate or 15–30 is the realistic band.",
    });
  }
  return flags;
}

function roleLine(role: Role): string {
  const company = getCompany(role.companyId);
  const snap = snapshotAt(role.companyId, role.start);
  const vintage = snap
    ? ` Joined when ${company.name} was ${snap.stage}, ~${snap.headcount.toLocaleString("en-IN")} people.`
    : "";
  return `${role.title} at ${company.name} (${yearRange(role.start, role.end)}). ${role.scope}${vintage}`;
}

function missingMusts(candidate: Candidate, icp: Icp): string[] {
  return icp.must.filter((m) => !mustHeld(candidate, m, icp));
}

export function narrate(candidate: Candidate, icp: Icp): Pick<
  GradedCandidate,
  "caseFor" | "caseAgainst" | "unclear" | "reviewerObjections" | "verdict"
> {
  const role = currentRole(candidate);
  const company = getCompany(role.companyId);
  const snap = snapshotAt(role.companyId, role.start);
  const first = candidate.name.split(" ")[0];
  const misses = missingMusts(candidate, icp);
  const flags = detectDisqualifiers(candidate, icp);

  const forBits: string[] = [roleLine(role)];
  if (snap) forBits.push(snap.signal);
  if (candidate.history[1]) {
    const prev = candidate.history[1];
    forBits.push(
      `Before that: ${prev.title} at ${getCompany(prev.companyId).name} (${yearRange(prev.start, prev.end)}).`,
    );
  }
  if (candidate.github) {
    const repo = candidate.github.repos[0];
    forBits.push(
      `GitHub @${candidate.github.handle}: ${candidate.github.contributions12m.toLocaleString("en-IN")} contributions in 12 months${
        repo ? `, notable repo ${repo.name} (${repo.stars} stars) — ${repo.description}` : ""
      }.`,
    );
  }
  if (candidate.talks[0]) {
    forBits.push(`Talk: “${candidate.talks[0].title}”, ${candidate.talks[0].venue} ${candidate.talks[0].year}.`);
  }
  if (candidate.writing[0]) {
    forBits.push(`Writing: “${candidate.writing[0].title}” (${candidate.writing[0].year}).`);
  }

  const againstBits: string[] = [];
  if (misses.length) {
    againstBits.push(`Thin on: ${misses.slice(0, 3).join("; ")}.`);
  }
  if (company.kind === "services") {
    againstBits.push(
      `${company.name} is a services shop. Treat the title as a billing grade until a dossier artifact contradicts that.`,
    );
  }
  if (company.kind === "faang") {
    againstBits.push(
      `${company.name} is a high bar and a weak product-ownership signal. Confirm they actually shipped, not reviewed.`,
    );
  }
  if (!candidate.github) {
    againstBits.push("No public GitHub. For this brief, that's a missing corroboration, not a deal-breaker.");
  } else if (candidate.github.contributions12m < 50) {
    againstBits.push("GitHub is quiet over the last year. Could be private work — mark as unclear, not as evidence.");
  }
  if (candidate.noticePeriodDays >= 60) {
    againstBits.push(`${candidate.noticePeriodDays}-day notice. Sequence outreach accordingly.`);
  }
  if (candidate.tenure === "hopper") {
    againstBits.push("Tenure is short on the current stint. Ask why, don't infer.");
  }
  if (candidate.expectedLpa && candidate.expectedLpa >= 55 && icp.seniority !== "staff" && icp.seniority !== "em") {
    againstBits.push(`Expected ${candidate.expectedLpa} LPA. If this role is budgeted under 45, skip the reveal.`);
  }
  if (candidate.city !== "Bengaluru" && icp.locations.includes("Bengaluru")) {
    againstBits.push(`Lives in ${candidate.city}. Onsite in Bengaluru is not free.`);
  }
  if (againstBits.length === 0) {
    againstBits.push(
      "No hard miss in the dossier. The risk is the usual one: public signal can outrun actual scope. Probe the last 18 months on the call.",
    );
  }

  const unclear: string[] = [];
  if (!candidate.github) unclear.push("No public GitHub — last 18 months of code is unverified.");
  if (candidate.talks.length === 0 && candidate.writing.length === 0) {
    unclear.push("No talks or writing. Scope is self-reported.");
  }
  if (role.end === null && role.start >= 2023) {
    unclear.push("Current stint is short. Trajectory at this company is still forming.");
  }
  if (candidate.github && candidate.github.repos.length === 0) {
    unclear.push("GitHub activity without a notable repo — could be work commits, could be noise.");
  }
  if (unclear.length === 0) {
    unclear.push("Comp band and reporting line are not in the dossier.");
  }

  const reviewerObjections: ReviewerObjection[] = [];
  if (snap && ["razorpay", "phonepe", "cred"].includes(role.companyId)) {
    reviewerObjections.push({
      claim: `The ${company.name} brand is doing work in the case for.`,
      objection: snap.signal.includes("vintage")
        ? "Correct to lean on vintage, but confirm team and scope. Brand in 2024 is not the 2019 job."
        : "Ask which team. At this headcount the same title covers routing core and plugin integrations.",
    });
  }
  if (candidate.talks[0]) {
    reviewerObjections.push({
      claim: `Public talk at ${candidate.talks[0].venue} is treated as reputation.`,
      objection:
        "A 25-minute slot is evidence they can explain the work, not that the market knows them. Don't overweight it.",
    });
  }
  if (flags.length) {
    reviewerObjections.push({
      claim: "This profile is still in the shortlist.",
      objection: `Disqualifier pass already raised ${flags.map((f) => f.flag.toLowerCase()).join(", ")}. Precision at the top of the list is the product. Don't bury the flag.`,
    });
  } else {
    reviewerObjections.push({
      claim: `${first} looks clean on paper.`,
      objection:
        "Recruiting has no compiler. The case for is built from public artifacts. The last 18 months of actual scope is still a conversation.",
    });
  }

  return {
    caseFor: forBits.join(" "),
    caseAgainst: againstBits.join(" "),
    unclear,
    reviewerObjections,
    verdict: "mixed" as Verdict,
  };
}

function bradleyTerry(items: { id: string; strength: number }[]): { id: string; strength: number }[] {
  const n = items.length;
  if (n === 0) return items;
  const p = items.map((it) => Math.max(0.15, it.strength));
  for (let iter = 0; iter < 24; iter += 1) {
    const next = p.slice();
    for (let i = 0; i < n; i += 1) {
      let num = 0;
      let den = 0;
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const pij = p[i] / (p[i] + p[j]);
        const observed = items[i].strength >= items[j].strength ? 1 : 0;
        // Deterministic slight upset from id hash so ranking isn't a raw sort.
        const upset = hashString(items[i].id + items[j].id) % 17 === 0 ? 1 - observed : observed;
        num += upset;
        den += 1 / (p[i] + p[j]);
        void pij;
      }
      next[i] = den === 0 ? p[i] : Math.max(0.05, num / den);
    }
    for (let i = 0; i < n; i += 1) p[i] = next[i];
  }
  return items
    .map((it, i) => ({ id: it.id, strength: p[i] }))
    .sort((a, b) => b.strength - a.strength);
}

export function runSearch(icp: Icp, limit = 22): GradedCandidate[] {
  const scored = candidates
    .map((c) => ({ id: c.id, strength: scoreCandidate(c, icp) }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 50);

  const ranked = bradleyTerry(scored).slice(0, limit);

  return ranked.map((row, index) => {
    const candidate = getCandidate(row.id)!;
    const narrative = narrate(candidate, icp);
    const disqualifiers = detectDisqualifiers(candidate, icp);
    const hardFlags = disqualifiers.filter((d) => d.flag !== "Location");
    let verdict: Verdict = "mixed";
    if (hardFlags.length > 0) verdict = "flagged";
    else if (index < 6) verdict = "strong";
    else if (index < 14) verdict = "mixed";
    else verdict = "weak";
    return {
      candidateId: candidate.id,
      rank: index + 1,
      verdict,
      caseFor: narrative.caseFor,
      caseAgainst: narrative.caseAgainst,
      unclear: narrative.unclear,
      disqualifiers,
      reviewerObjections: narrative.reviewerObjections,
      score: row.strength,
    };
  });
}

export function applyFeedbackRerank(
  results: GradedCandidate[],
  feedback: Record<string, { vote: "up" | "down"; tags: string[] }>,
): GradedCandidate[] {
  const adjusted = results.map((r) => {
    const fb = feedback[r.candidateId];
    let s = r.score;
    if (fb?.vote === "up") s += 8;
    if (fb?.vote === "down") s -= 12;
    return { ...r, score: s };
  });
  return adjusted
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function proposeIcpDiff(
  icp: Icp,
  tag: string,
): { addMust: string[]; addDisqualifiers: string[]; note: string } | undefined {
  const map: Record<string, { addMust?: string[]; addDisqualifiers?: string[]; note: string }> = {
    "too senior": {
      addDisqualifiers: ["Staff-plus / people managers"],
      note: "You marked someone too senior. Add a disqualifier so the next rank drops managers and 12-year ICs.",
    },
    "too junior": {
      addMust: ["Proven ownership of a production system, not just tickets"],
      note: "You marked someone too junior. Tighten the must-haves around ownership.",
    },
    "wrong domain": {
      addMust: ["Domain match: same industry as the brief"],
      note: "You marked a domain miss. Make industry a must, not a nice-to-have.",
    },
    location: {
      addDisqualifiers: ["Outside the stated city without relocation"],
      note: "Location is now a hard filter, not a preference.",
    },
    "skills miss": {
      addMust: ["Primary stack as a must, not a keyword match"],
      note: "A skills miss should fail Stage 1, not show up in the top 20.",
    },
    "company type": {
      addDisqualifiers: ["Services-only background"],
      note: "Company type is the ranking thesis. Promote it to a disqualifier.",
    },
    notice: {
      addDisqualifiers: ["Notice period over 30 days"],
      note: "Notice becomes a hard cap so 90-day profiles drop before grading.",
    },
    comp: {
      addDisqualifiers: ["Expected comp clearly above band"],
      note: "Comp mismatch should be a disqualifier, not a surprise on the call.",
    },
  };
  const hit = map[tag];
  if (!hit) return undefined;
  return {
    addMust: (hit.addMust ?? []).filter((m) => !icp.must.includes(m)),
    addDisqualifiers: (hit.addDisqualifiers ?? []).filter((d) => !icp.disqualifiers.includes(d)),
    note: hit.note,
  };
}

export const FEEDBACK_TAGS = [
  "too senior",
  "too junior",
  "wrong domain",
  "location",
  "skills miss",
  "company type",
  "notice",
  "comp",
  "strong signal",
] as const;

export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export function candidateSummaryForLlm(candidate: Candidate): string {
  const roles = candidate.history
    .map((r) => {
      const company = getCompany(r.companyId);
      const snap = snapshotAt(r.companyId, r.start);
      return `- ${r.title} @ ${company.name} (${company.kind}, ${yearRange(r.start, r.end)}). ${r.scope}${
        snap ? ` [company then: ${snap.stage}, ~${snap.headcount} ppl]` : ""
      }`;
    })
    .join("\n");
  return [
    `id: ${candidate.id}`,
    `name: ${candidate.name}`,
    `headline: ${candidate.headline}`,
    `city: ${candidate.city}; years: ${candidate.years}; notice: ${candidate.noticePeriodDays}d; visa: ${candidate.visa}; expected: ${candidate.expectedLpa ?? "?"} LPA; stuffed: ${candidate.stuffed}`,
    `education: ${candidate.education.degree}, ${candidate.education.school}`,
    `skills: ${candidate.skills.join(", ")}`,
    `history:\n${roles}`,
    candidate.github
      ? `github: @${candidate.github.handle}, ${candidate.github.contributions12m}/12m, langs ${candidate.github.languages.join(
          "/",
        )}, repos: ${candidate.github.repos.map((r) => `${r.name} (${r.stars})`).join("; ") || "none"}`
      : "github: none",
    `talks: ${candidate.talks.map((t) => `${t.title} @ ${t.venue} ${t.year}`).join("; ") || "none"}`,
    `writing: ${candidate.writing.map((w) => `${w.title} ${w.year}`).join("; ") || "none"}`,
  ].join("\n");
}

export function draftOutreach(candidate: Candidate, icp: Icp): string {
  const first = candidate.name.split(" ")[0];
  const role = currentRole(candidate);
  const company = getCompany(role.companyId);
  const snap = snapshotAt(role.companyId, role.start);
  const artifact =
    candidate.talks[0]?.title ??
    candidate.writing[0]?.title ??
    candidate.github?.repos[0]?.name ??
    null;

  const artifactLine = artifact
    ? `I read “${artifact}” against what we're doing on ${icp.title.toLowerCase()}.`
    : `Your ${role.title.toLowerCase()} years at ${company.name} are the closest public match I have for this brief.`;

  const vintage = snap
    ? ` The relevant vintage is ${role.start} at ${company.name} (${snap.stage}, ~${snap.headcount.toLocaleString("en-IN")} people) — not the logo as it stands today.`
    : "";

  return `Hi ${first} — ${artifactLine}${vintage} We're hiring a ${icp.title} in ${icp.locations[0] ?? "India"}. ${icp.summary} If the problem still interests you, I'll send the brief.`;
}

export function draftOutreachSubject(candidate: Candidate, icp: Icp): string {
  const where = icp.locations[0] ?? candidate.city;
  return `${icp.title} — ${where}`;
}

export function syntheticEmail(candidate: Candidate): string {
  const first = candidate.name.split(" ")[0].toLowerCase();
  const last = candidate.name.split(" ").slice(-1)[0].toLowerCase().replace(/[^a-z]/g, "");
  return `${first}.${last}@example.com`;
}
