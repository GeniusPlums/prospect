import { candidates } from "@/lib/data/candidates";
import { localSource } from "@/lib/adapters/profile-source/local";
import type { CollectedProfile, PeopleSource, SearchHit } from "@/lib/adapters/profile-source/types";
import { executeIntent, firstActive } from "@/lib/composio/client";
import { parsePeople } from "@/lib/composio/parse";

const SOURCING = ["apollo", "linkedin", "peopledatalabs"] as const;

export async function composioPeopleSource(orgId: string): Promise<PeopleSource | null> {
  const connection = await firstActive(orgId, SOURCING);
  if (!connection) return null;

  const extras = new Map<string, CollectedProfile>();

  const source: PeopleSource = {
    name: "composio",
    async search(query) {
      const localHits = await localSource.search(query);
      const icp = (query as { icp?: { title?: string; skills?: string[]; locations?: string[] } }).icp;
      const result = await executeIntent({
        orgId,
        toolkit: connection.toolkit,
        connectedAccountId: connection.connected_account_id,
        needles: ["search", "people"],
        arguments: {
          q: [icp?.title, ...(icp?.skills ?? []).slice(0, 4)].filter(Boolean).join(" "),
          query: icp?.title ?? "",
          keywords: (icp?.skills ?? []).slice(0, 6).join(", "),
          location: icp?.locations?.[0] ?? "India",
        },
      });
      const people = parsePeople(result.data);
      for (const person of people) {
        extras.set(person.externalId, {
          externalId: person.externalId,
          linkedinUrl: person.linkedinUrl,
          displayName: person.displayName,
          headline: person.headline,
          city: person.city,
          years: person.years,
          raw: person.raw,
        });
      }
      const seen = new Set(localHits.map((hit) => hit.externalId));
      const remote: SearchHit[] = people
        .filter((person) => !seen.has(person.externalId))
        .map((person) => ({ externalId: person.externalId, cacheKey: person.linkedinUrl || person.externalId }));
      return [...localHits, ...remote];
    },
    async collect(ids) {
      const localIds = ids.filter((id) => candidates.some((person) => person.id === id));
      const remoteIds = ids.filter((id) => !localIds.includes(id));
      const collected = localIds.length ? await localSource.collect(localIds) : [];
      const fromSearch = remoteIds
        .map((id) => extras.get(id))
        .filter((row): row is CollectedProfile => Boolean(row));
      const missing = remoteIds.filter((id) => !extras.has(id));
      if (missing.length) {
        const result = await executeIntent({
          orgId,
          toolkit: connection.toolkit,
          connectedAccountId: connection.connected_account_id,
          needles: ["get", "person"],
          arguments: { ids: missing, id: missing[0] },
        });
        for (const person of parsePeople(result.data)) {
          fromSearch.push({
            externalId: person.externalId,
            linkedinUrl: person.linkedinUrl,
            displayName: person.displayName,
            headline: person.headline,
            city: person.city,
            years: person.years,
            raw: person.raw,
          });
        }
      }
      return [...collected, ...fromSearch];
    },
  };
  return source;
}
