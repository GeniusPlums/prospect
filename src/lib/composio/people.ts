import type { CollectedProfile, PeopleSource, SearchHit } from "@/lib/adapters/profile-source/types";
import { firstActiveForRole, executeIntent } from "@/lib/composio/client";
import { parsePeople } from "@/lib/composio/parse";

export async function composioPeopleSource(orgId: string): Promise<PeopleSource | null> {
  const connection = await firstActiveForRole(orgId, "sourcing", "people_search");
  if (!connection) return null;

  const extras = new Map<string, CollectedProfile>();

  const source: PeopleSource = {
    name: connection.toolkit,
    async search(query) {
      const icp = (query as { icp?: { title?: string; skills?: string[]; locations?: string[] } }).icp;
      const result = await executeIntent({
        orgId,
        toolkit: connection.toolkit,
        connectedAccountId: connection.connected_account_id,
        intent: "people_search",
        facts: {
          q: [icp?.title, ...(icp?.skills ?? []).slice(0, 4)].filter(Boolean).join(" "),
          query: icp?.title ?? "",
          keywords: (icp?.skills ?? []).slice(0, 6).join(", "),
          location: icp?.locations?.[0] ?? "India",
          limit: 20,
        },
      });
      if (result.successful === false) return [];
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
      return people.map(
        (person): SearchHit => ({
          externalId: person.externalId,
          cacheKey: person.linkedinUrl || person.externalId,
        }),
      );
    },
    async collect(ids) {
      const fromSearch = ids
        .map((id) => extras.get(id))
        .filter((row): row is CollectedProfile => Boolean(row));
      const missing = ids.filter((id) => !extras.has(id));
      if (missing.length) {
        const result = await executeIntent({
          orgId,
          toolkit: connection.toolkit,
          connectedAccountId: connection.connected_account_id,
          intent: "person_get",
          facts: { ids: missing, id: missing[0] },
        });
        if (result.successful !== false) {
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
      }
      return fromSearch;
    },
  };
  return source;
}
