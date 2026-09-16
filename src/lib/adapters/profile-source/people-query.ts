import type { Icp } from "@/lib/types";
import type { CollectedProfile } from "./types";

export function capCollect(missCount: number, remaining: number, perSearch = 22): number {
  if (missCount <= 0 || remaining <= 0) return 0;
  return Math.min(missCount, remaining, perSearch);
}

export function buildCoresignalSearchBody(icp: Icp): Record<string, unknown> {
  const skills = icp.skills.slice(0, 4).filter(Boolean);
  const title = icp.title.replace(/"/g, "").slice(0, 80);
  const loc = (icp.locations[0] ?? "India").replace(/"/g, "");
  const should: unknown[] = [
    {
      query_string: {
        query: `"${title}"`,
        default_field: "active_experience_title",
        default_operator: "and",
      },
    },
    {
      query_string: {
        query: `"${title}"`,
        default_field: "headline",
        default_operator: "and",
      },
    },
  ];
  for (const skill of skills) {
    should.push({
      query_string: {
        query: skill.replace(/"/g, ""),
        default_field: "description",
        default_operator: "and",
      },
    });
  }
  return {
    query: {
      bool: {
        must: [
          {
            query_string: {
              query: loc,
              default_field: "location_country",
              default_operator: "or",
            },
          },
        ],
        should,
        minimum_should_match: 1,
      },
    },
  };
}

export function parseSearchIds(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data
      .map((row) => {
        if (typeof row === "number" || typeof row === "string") return String(row);
        if (row && typeof row === "object") {
          const rec = row as Record<string, unknown>;
          const id = rec.id ?? rec.employee_id ?? rec.external_id;
          return id != null ? String(id) : "";
        }
        return "";
      })
      .filter(Boolean);
  }
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const key of ["ids", "results", "data", "items"]) {
      if (key in rec) return parseSearchIds(rec[key]);
    }
  }
  return [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function profileFromCoresignal(row: Record<string, unknown>): CollectedProfile | null {
  const id = row.id ?? row.employee_id ?? row.external_id;
  if (id == null) return null;
  const experience = Array.isArray(row.experience) ? row.experience : [];
  const titles = experience
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const rec = item as Record<string, unknown>;
      return [asString(rec.title), asString(rec.company_name) || asString(rec.company)]
        .filter(Boolean)
        .join(" @ ");
    })
    .filter(Boolean);
  const yearsRaw = row.inferred_years_experience ?? row.duration_months ?? row.years;
  const years =
    typeof yearsRaw === "number"
      ? yearsRaw > 40
        ? Math.round(yearsRaw / 12)
        : yearsRaw
      : Number(yearsRaw) || 0;
  return {
    externalId: String(id),
    linkedinUrl: asString(row.linkedin_url) || asString(row.linkedin_url_canonical) || asString(row.websites),
    displayName: asString(row.full_name) || asString(row.name) || `Employee ${id}`,
    headline:
      asString(row.headline) ||
      asString(row.active_experience_title) ||
      titles[0] ||
      "",
    city:
      asString(row.location_city) ||
      asString(row.location_raw_address) ||
      asString(row.location_country) ||
      "",
    years,
    raw: { ...row, _titles: titles },
  };
}

export function buildGithubUserQuery(icp: Icp): string {
  const loc = (icp.locations[0] ?? "India").replace(/[^\w\s-]/g, "").trim() || "India";
  const skill = (icp.skills[0] ?? icp.title.split(/\s+/)[0] ?? "engineer")
    .replace(/[^\w+#.-]/g, "")
    .slice(0, 40);
  return `${skill} location:${loc} type:user`.slice(0, 240);
}

export function profileFromGithub(
  user: Record<string, unknown>,
  repos: Array<Record<string, unknown>> = [],
): CollectedProfile | null {
  const login = asString(user.login);
  if (!login) return null;
  const created = asString(user.created_at);
  const createdYear = created ? new Date(created).getUTCFullYear() : new Date().getUTCFullYear();
  const years = Math.max(1, new Date().getUTCFullYear() - createdYear);
  const repoBits = repos
    .slice(0, 6)
    .map((repo) => {
      const name = asString(repo.name);
      const desc = asString(repo.description);
      const lang = asString(repo.language);
      return [name, lang, desc].filter(Boolean).join(" — ");
    })
    .filter(Boolean);
  const headline =
    asString(user.bio) ||
    asString(user.company) ||
    repoBits[0] ||
    "Software engineer";
  return {
    externalId: login,
    linkedinUrl: asString(user.html_url) || `https://github.com/${login}`,
    displayName: asString(user.name) || login,
    headline: headline.slice(0, 280),
    city: asString(user.location),
    years,
    raw: { user, repos: repoBits },
  };
}

export function dossierHay(profile: CollectedProfile): string {
  const titles = Array.isArray((profile.raw as { _titles?: string[] } | null)?._titles)
    ? ((profile.raw as { _titles?: string[] })._titles ?? [])
    : [];
  const repos = Array.isArray((profile.raw as { repos?: string[] } | null)?.repos)
    ? ((profile.raw as { repos?: string[] }).repos ?? [])
    : [];
  return [profile.displayName, profile.headline, profile.city, String(profile.years), ...titles, ...repos]
    .filter(Boolean)
    .join(" ");
}
