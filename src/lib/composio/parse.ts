const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function findEmail(data: unknown, depth = 0): string | null {
  if (depth > 8 || data == null) return null;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (EMAIL_RE.test(trimmed) && !trimmed.toLowerCase().endsWith("@example.com")) return trimmed;
    const nested = trimmed.match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/);
    if (nested && EMAIL_RE.test(nested[0]) && !nested[0].toLowerCase().endsWith("@example.com")) {
      return nested[0];
    }
    return null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const hit = findEmail(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof data === "object") {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (/email/i.test(key) && typeof value === "string") {
        const hit = findEmail(value, depth + 1);
        if (hit) return hit;
      }
    }
    for (const value of Object.values(data as Record<string, unknown>)) {
      const hit = findEmail(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

export type ParsedPerson = {
  externalId: string;
  displayName: string;
  headline: string;
  city: string;
  years: number;
  linkedinUrl: string;
  raw: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function personFromObject(row: Record<string, unknown>, index: number): ParsedPerson | null {
  const displayName =
    asString(row.name) ||
    asString(row.full_name) ||
    asString(row.fullName) ||
    [asString(row.first_name) || asString(row.firstName), asString(row.last_name) || asString(row.lastName)]
      .filter(Boolean)
      .join(" ");
  const linkedinUrl =
    asString(row.linkedin_url) ||
    asString(row.linkedinUrl) ||
    asString(row.profile_url) ||
    asString(row.url);
  const externalId =
    asString(row.id) ||
    asString(row.person_id) ||
    asString(row.external_id) ||
    linkedinUrl ||
    (displayName ? `person-${index}-${displayName.toLowerCase().replace(/\s+/g, "-")}` : "");
  if (!externalId && !displayName) return null;
  const yearsRaw = row.years ?? row.years_experience ?? row.experience_years;
  const years = typeof yearsRaw === "number" ? yearsRaw : Number(yearsRaw) || 0;
  return {
    externalId: externalId || `person-${index}`,
    displayName: displayName || externalId || `Person ${index + 1}`,
    headline: asString(row.headline) || asString(row.title) || asString(row.current_title),
    city: asString(row.city) || asString(row.location) || asString(row.country),
    years,
    linkedinUrl,
    raw: row,
  };
}

export function parsePeople(data: unknown, depth = 0): ParsedPerson[] {
  if (depth > 6 || data == null) return [];
  if (Array.isArray(data)) {
    return data.flatMap((item, i) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const person = personFromObject(item as Record<string, unknown>, i);
        return person ? [person] : parsePeople(item, depth + 1);
      }
      return parsePeople(item, depth + 1);
    });
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const buckets = ["people", "persons", "candidates", "contacts", "items", "results", "data", "matches"];
    for (const key of buckets) {
      if (key in record) {
        const nested = parsePeople(record[key], depth + 1);
        if (nested.length) return nested;
      }
    }
    const self = personFromObject(record, 0);
    return self ? [self] : Object.values(record).flatMap((value) => parsePeople(value, depth + 1));
  }
  return [];
}

export function parseAtsPeople(data: unknown): { mergeId: string; name: string; stage: string; outcome: string | null }[] {
  return parsePeople(data).map((person) => ({
    mergeId: person.externalId,
    name: person.displayName,
    stage: asString((person.raw as Record<string, unknown> | undefined)?.stage) || "sourced",
    outcome: asString((person.raw as Record<string, unknown> | undefined)?.outcome) || null,
  }));
}
