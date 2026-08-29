import type { SampleBrief } from "@/lib/types";

export const sampleBriefs: SampleBrief[] = [
  {
    id: "payments-backend",
    label: "Senior backend · payments",
    blurb: "Bengaluru · Go/Java · UPI or ledger work · product companies",
    jd: `Senior Backend Engineer — Payments, Bengaluru

We're a 40-person payments infrastructure company in Bengaluru. We run checkout, routing, and retry for Indian cards and UPI.

You will:
- Own part of the payment routing and retry ledger
- Write Go or Java in production, Postgres, Kafka
- Sit on-call for payment success rate

Must:
- 5–9 years building backend systems
- Production payments, UPI, cards, or ledger experience
- Product-company background (not a services account)
- Bengaluru or willing to be here 3 days a week

Nice:
- Public writing or talks about retries, idempotency, ledgers
- Go
- Experience at Indian fintech from the 2018–2021 vintage

Not a fit:
- Pure IT-services background with no product ownership
- 90-day notice if we can't buy it out
- People currently running a US visa process
- Staff-plus people managers who have not been IC for years`,
    icp: {
      title: "Senior Backend Engineer, Payments",
      summary:
        "Product-company backend, 5–9 years, payments or ledger, Bengaluru. Go or Java. No services-only profiles.",
      must: [
        "5–9 years backend",
        "Payments, UPI, cards, or ledger",
        "Product-company background",
        "Bengaluru",
      ],
      nice: ["Go", "Public talks or writing on retries / ledgers", "2018–2021 Indian fintech vintage"],
      disqualifiers: [
        "Services-only background",
        "90-day notice we cannot buy out",
        "Actively running a US visa process",
        "People managers who have not been IC recently",
      ],
      locations: ["Bengaluru"],
      seniority: "senior",
      yearsMin: 5,
      yearsMax: 9,
      companyKinds: ["fintech", "saas", "startup"],
      skills: ["Go", "Java", "Kafka", "PostgreSQL", "UPI", "ledger"],
    },
  },
  {
    id: "founding-engineer",
    label: "Founding engineer · seed",
    blurb: "Full-stack · high ownership · public artifacts · 4–8 years",
    jd: `Founding Engineer — Seed fintech, Bengaluru

We are three people, a ledger, and a design partner. You will ship the product with us for the next 18 months. Backend-leaning full stack. Equity is real.

Must:
- 4–8 years
- Have been early at a small team, or have public work that proves you can
- TypeScript or Go, and enough React to ship a dashboard
- Comfortable without a manager, PM, or design system

Nice:
- Prior seed or Series A
- Open source with actual users
- KYC / ledger / billing domain

Not a fit:
- Large-org specialists who need a lane
- Anyone who hasn't shipped in the last year
- 60+ day notice`,
    icp: {
      title: "Founding Engineer",
      summary:
        "Seed fintech, backend-leaning full stack, 4–8 years, evidence of shipping without a lane.",
      must: [
        "4–8 years",
        "Early-team or strong public artifacts",
        "TypeScript or Go, plus enough React",
        "Shipped without a manager",
      ],
      nice: ["Seed or Series A vintage", "Open source with users", "KYC / ledger / billing"],
      disqualifiers: [
        "Large-org specialists who need a lane",
        "No shipping in the last year",
        "60+ day notice",
      ],
      locations: ["Bengaluru"],
      seniority: "founding",
      yearsMin: 4,
      yearsMax: 8,
      companyKinds: ["startup", "fintech", "saas"],
      skills: ["TypeScript", "Go", "React", "PostgreSQL", "Next.js"],
    },
  },
  {
    id: "staff-frontend",
    label: "Staff frontend · design systems",
    blurb: "React · systems used by more than one product · 8+ years",
    jd: `Staff Frontend Engineer — Design systems, Bengaluru / remote-India

Our design system is used by four product teams and is starting to crack. We need someone who has already owned a system through that phase.

Must:
- 8+ years of product frontend
- Owned a design system or component library used by more than one product
- React and TypeScript at a depth that includes performance and a11y
- Evidence: talks, writing, or a public library

Nice:
- SaaS / developer-tool companies
- Theming, tokens, headless primitives

Not a fit:
- Feature-factory frontend with no systems work
- Visual design as the primary craft`,
    icp: {
      title: "Staff Frontend Engineer, Design Systems",
      summary:
        "8+ years, owned a multi-product design system, React/TypeScript, public evidence.",
      must: [
        "8+ years product frontend",
        "Owned a multi-product design system",
        "React and TypeScript including a11y and performance",
        "Public evidence (talk, writing, or library)",
      ],
      nice: ["SaaS or developer tools", "Theming and tokens", "Headless primitives"],
      disqualifiers: [
        "Feature-factory frontend with no systems work",
        "Visual design as the primary craft",
      ],
      locations: ["Bengaluru", "India remote"],
      seniority: "staff",
      yearsMin: 8,
      yearsMax: 14,
      companyKinds: ["saas", "faang", "consumer"],
      skills: ["React", "TypeScript", "design systems", "a11y", "CSS"],
    },
  },
  {
    id: "ml-ranking",
    label: "ML engineer · ranking",
    blurb: "Search or recommendations · production, not notebooks · 5–10 years",
    jd: `ML Engineer — Ranking & recommendations, Bengaluru

We need someone who has shipped a ranking system that a user actually saw. Not a notebook. Not an LLM wrapper.

Must:
- 5–10 years
- Production ranking, search, or recommendations
- Python, and enough of the serving path to argue with backend
- Can explain an offline metric and the online one that actually moved

Nice:
- Indian marketplace or fintech ranking
- Learning-to-rank, two-tower, or retrieval rewrites
- Public talks

Not a fit:
- Prompt-engineering as the whole job
- Research-only with no production ownership
- 90-day notice`,
    icp: {
      title: "ML Engineer, Ranking",
      summary:
        "Production ranking or recommendations, 5–10 years, Python plus serving path. No LLM-wrapper profiles.",
      must: [
        "5–10 years",
        "Production ranking, search, or recommendations",
        "Python and a serving path",
        "Offline and online metrics",
      ],
      nice: [
        "Indian marketplace or fintech ranking",
        "Learning-to-rank or two-tower",
        "Public talks",
      ],
      disqualifiers: [
        "Prompt-engineering as the whole job",
        "Research-only, no production",
        "90-day notice",
      ],
      locations: ["Bengaluru"],
      seniority: "senior",
      yearsMin: 5,
      yearsMax: 10,
      companyKinds: ["consumer", "fintech", "faang", "saas"],
      skills: ["Python", "ranking", "search", "PyTorch", "XGBoost"],
    },
  },
];

export function getSampleBrief(id: string): SampleBrief | undefined {
  return sampleBriefs.find((s) => s.id === id);
}
