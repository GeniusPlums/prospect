export const RECOMMENDED = [
  { slug: "greenhouse", lane: "hr" as const, label: "Greenhouse", blurb: "Create candidates and read stages" },
  { slug: "lever", lane: "hr" as const, label: "Lever", blurb: "Opportunities and sourced origin" },
  { slug: "ashby", lane: "hr" as const, label: "Ashby", blurb: "Jobs and applications" },
  { slug: "workday", lane: "hr" as const, label: "Workday", blurb: "HRIS write-back" },
  { slug: "bamboohr", lane: "hr" as const, label: "BambooHR", blurb: "Employee records" },
  { slug: "apollo", lane: "sourcing" as const, label: "Apollo", blurb: "People search on cache miss" },
  { slug: "hunter", lane: "sourcing" as const, label: "Hunter", blurb: "Email on reveal only" },
  { slug: "peopledatalabs", lane: "sourcing" as const, label: "People Data Labs", blurb: "Profile enrich on click" },
  { slug: "linkedin", lane: "sourcing" as const, label: "LinkedIn", blurb: "Limited member scopes" },
  { slug: "gmail", lane: "outreach" as const, label: "Gmail", blurb: "Send after a reveal" },
  { slug: "outlook", lane: "outreach" as const, label: "Outlook", blurb: "Send after a reveal" },
  { slug: "slack", lane: "outreach" as const, label: "Slack", blurb: "Notify hiring channel" },
] as const;

export type ToolkitLane = (typeof RECOMMENDED)[number]["lane"];
