import type { Company, CompanySnapshot } from "@/lib/types";

export const companies: Record<string, Company> = {
  razorpay: {
    id: "razorpay",
    name: "Razorpay",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2018,
        stage: "Series C",
        headcount: 280,
        signal:
          "UPI and checkout were still being productized. An engineer here sat close to the metal.",
      },
      {
        year: 2021,
        stage: "Series E",
        headcount: 1200,
        signal: "Scaled payments infrastructure, still product-led.",
      },
      {
        year: 2024,
        stage: "Late",
        headcount: 3500,
        signal:
          "Household brand. Title inflation is real; vintage matters more than the logo.",
      },
    ],
  },
  phonepe: {
    id: "phonepe",
    name: "PhonePe",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2018,
        stage: "Hyper-growth",
        headcount: 900,
        signal: "UPI scale before it was obvious. Reliability work here is a real signal.",
      },
      {
        year: 2023,
        stage: "Late / IPO path",
        headcount: 5000,
        signal: "National-scale consumer payments. Scope varies wildly by team.",
      },
    ],
  },
  cred: {
    id: "cred",
    name: "CRED",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2019,
        stage: "Series A",
        headcount: 80,
        signal: "Early credit-card bill product. Founding-adjacent scope.",
      },
      {
        year: 2022,
        stage: "Series F",
        headcount: 900,
        signal: "Consumer fintech with a brand. Engineering bar is uneven by org.",
      },
    ],
  },
  groww: {
    id: "groww",
    name: "Groww",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2020,
        stage: "Series B",
        headcount: 250,
        signal: "Retail brokerage building out its own stack.",
      },
      {
        year: 2024,
        stage: "Late",
        headcount: 1400,
        signal: "Public-path brokerage. More process, still product.",
      },
    ],
  },
  zerodha: {
    id: "zerodha",
    name: "Zerodha",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2018,
        stage: "Bootstrapped",
        headcount: 400,
        signal: "Profitable brokerage. Small teams, high ownership, no title theatre.",
      },
      {
        year: 2024,
        stage: "Bootstrapped",
        headcount: 1100,
        signal: "Still bootstrapped. A stint here reads as craft, not brand-chasing.",
      },
    ],
  },
  cashfree: {
    id: "cashfree",
    name: "Cashfree",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2017,
        stage: "Seed / A",
        headcount: 60,
        signal: "Payouts APIs for platforms. Early infrastructure work.",
      },
      {
        year: 2023,
        stage: "Series C",
        headcount: 700,
        signal: "Payments OS for businesses. Solid, less famous than Razorpay.",
      },
    ],
  },
  slice: {
    id: "slice",
    name: "Slice",
    kind: "fintech",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2021,
        stage: "Series A",
        headcount: 180,
        signal: "Consumer credit card. Fast, messy, high-ownership years.",
      },
    ],
  },
  swiggy: {
    id: "swiggy",
    name: "Swiggy",
    kind: "consumer",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2018,
        stage: "Series F",
        headcount: 2500,
        signal: "Logistics and marketplace at Indian scale.",
      },
      {
        year: 2023,
        stage: "Late",
        headcount: 6000,
        signal: "Public-path consumer. Ranking and logistics teams still do real work.",
      },
    ],
  },
  flipkart: {
    id: "flipkart",
    name: "Flipkart",
    kind: "consumer",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2016,
        stage: "Walmart era start",
        headcount: 8000,
        signal: "Indian e-commerce scale. Strong systems, slower product cycle.",
      },
      {
        year: 2023,
        stage: "Walmart",
        headcount: 12000,
        signal: "Large-org engineering. Title is a weak signal; team is the signal.",
      },
    ],
  },
  meesho: {
    id: "meesho",
    name: "Meesho",
    kind: "consumer",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2021,
        stage: "Series E",
        headcount: 900,
        signal: "Social commerce, price-sensitive India. Hard product constraints.",
      },
    ],
  },
  postman: {
    id: "postman",
    name: "Postman",
    kind: "saas",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2019,
        stage: "Series B",
        headcount: 200,
        signal: "Developer tool going global from Bengaluru. High craft bar.",
      },
      {
        year: 2023,
        stage: "Series D",
        headcount: 800,
        signal: "Grown-up SaaS. Design systems and platform teams are real.",
      },
    ],
  },
  freshworks: {
    id: "freshworks",
    name: "Freshworks",
    kind: "saas",
    city: "Chennai",
    snapshots: [
      {
        year: 2018,
        stage: "Pre-IPO",
        headcount: 1800,
        signal: "Indian SaaS at US scale. Process-heavy, product still ships.",
      },
      {
        year: 2023,
        stage: "Public",
        headcount: 5000,
        signal: "Public SaaS. Staff IC bar is credible on platform teams.",
      },
    ],
  },
  zoho: {
    id: "zoho",
    name: "Zoho",
    kind: "saas",
    city: "Chennai",
    snapshots: [
      {
        year: 2016,
        stage: "Bootstrapped",
        headcount: 7000,
        signal: "Deep product ownership, little brand heat. Underrated craft.",
      },
    ],
  },
  browserstack: {
    id: "browserstack",
    name: "BrowserStack",
    kind: "saas",
    city: "Mumbai",
    snapshots: [
      {
        year: 2019,
        stage: "Growth",
        headcount: 400,
        signal: "Devtools, profitable, engineering-led. Strong IC culture.",
      },
    ],
  },
  hasura: {
    id: "hasura",
    name: "Hasura",
    kind: "saas",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2020,
        stage: "Series B",
        headcount: 80,
        signal: "Open-source infra, tiny team. Every engineer had product surface.",
      },
    ],
  },
  chargebee: {
    id: "chargebee",
    name: "Chargebee",
    kind: "saas",
    city: "Chennai",
    snapshots: [
      {
        year: 2019,
        stage: "Series C",
        headcount: 350,
        signal: "Billing infrastructure. Domain-adjacent to payments.",
      },
    ],
  },
  dyte: {
    id: "dyte",
    name: "Dyte",
    kind: "startup",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2022,
        stage: "Series A",
        headcount: 40,
        signal: "Realtime video SDK. Early-stage, high ownership.",
      },
    ],
  },
  atlas: {
    id: "atlas",
    name: "Atlassian",
    kind: "faang",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2021,
        stage: "Public",
        headcount: 800,
        signal: "Bengaluru hub of a global product company. Process plus craft.",
      },
    ],
  },
  google: {
    id: "google",
    name: "Google",
    kind: "faang",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2018,
        stage: "Public",
        headcount: 4000,
        signal: "India GPay / Cloud / Search. High bar, variable product ownership.",
      },
    ],
  },
  amazon: {
    id: "amazon",
    name: "Amazon",
    kind: "faang",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2017,
        stage: "Public",
        headcount: 9000,
        signal: "India retail and AWS-adjacent. Operational excellence, slower product.",
      },
    ],
  },
  microsoft: {
    id: "microsoft",
    name: "Microsoft",
    kind: "faang",
    city: "Hyderabad",
    snapshots: [
      {
        year: 2019,
        stage: "Public",
        headcount: 8000,
        signal: "IDC. Strong systems, weak signal for startup pace.",
      },
    ],
  },
  infosys: {
    id: "infosys",
    name: "Infosys",
    kind: "services",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2016,
        stage: "Public",
        headcount: 200000,
        signal: "IT services. Title maps to billing, not scope. Weak product signal.",
      },
    ],
  },
  tcs: {
    id: "tcs",
    name: "TCS",
    kind: "services",
    city: "Mumbai",
    snapshots: [
      {
        year: 2015,
        stage: "Public",
        headcount: 400000,
        signal: "Largest services shop. Almost no product-building signal on its own.",
      },
    ],
  },
  wipro: {
    id: "wipro",
    name: "Wipro",
    kind: "services",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2017,
        stage: "Public",
        headcount: 160000,
        signal: "Services. Treat claimed stacks as untrusted until artifacts exist.",
      },
    ],
  },
  cognizant: {
    id: "cognizant",
    name: "Cognizant",
    kind: "services",
    city: "Chennai",
    snapshots: [
      {
        year: 2016,
        stage: "Public",
        headcount: 250000,
        signal: "Services. Same caution as the other majors.",
      },
    ],
  },
  folio: {
    id: "folio",
    name: "Folio",
    kind: "startup",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2023,
        stage: "Seed",
        headcount: 8,
        signal: "Seed fintech. Founding engineer means everything shipped through them.",
      },
    ],
  },
  kiln: {
    id: "kiln",
    name: "Kiln Labs",
    kind: "startup",
    city: "Bengaluru",
    snapshots: [
      {
        year: 2021,
        stage: "Seed",
        headcount: 6,
        signal: "Failed quietly in 2023. The GitHub from this period is the signal.",
      },
    ],
  },
  urban: {
    id: "urban",
    name: "Urban Company",
    kind: "consumer",
    city: "Gurugram",
    snapshots: [
      {
        year: 2020,
        stage: "Series E",
        headcount: 1200,
        signal: "Marketplace ops plus consumer app. Mixed engineering signal.",
      },
    ],
  },
};

export function getCompany(id: string): Company {
  const company = companies[id];
  if (!company) {
    return {
      id,
      name: id,
      kind: "startup",
      city: "Bengaluru",
      snapshots: [],
    };
  }
  return company;
}

export function snapshotAt(companyId: string, year: number): CompanySnapshot | null {
  const company = getCompany(companyId);
  const eligible = company.snapshots
    .filter((s) => s.year <= year)
    .sort((a, b) => b.year - a.year);
  return eligible[0] ?? company.snapshots[0] ?? null;
}
