import type { PeopleSource, SearchHit } from "./types";
import { localSource } from "./local";
import { buildCoresignalSearchBody, parseSearchIds, profileFromCoresignal } from "./people-query";
import type { Icp } from "@/lib/types";

const BASE = "https://api.coresignal.com/cdapi/v2/employee_clean";

async function coresignalJson(path: string, init?: RequestInit): Promise<unknown> {
  const apiKey = process.env.CORESIGNAL_API_KEY;
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY is not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      apikey: apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Coresignal HTTP ${res.status}`);
  return res.json();
}

/** Unused product path. Prospect does not sell Coresignal; user-owned Composio sourcing is the live index. */
export const coresignalSource: PeopleSource = {
  name: "coresignal",
  async search(query) {
    if (!process.env.CORESIGNAL_API_KEY) return localSource.search(query);
    const icp = (query as { icp?: Icp }).icp;
    if (!icp) return [];
    const data = await coresignalJson("/search/es_dsl", {
      method: "POST",
      body: JSON.stringify(buildCoresignalSearchBody(icp)),
    });
    return parseSearchIds(data)
      .slice(0, 40)
      .map((id): SearchHit => ({ externalId: id, cacheKey: id }));
  },
  async collect(ids) {
    if (!process.env.CORESIGNAL_API_KEY) return localSource.collect(ids);
    const out = [];
    const batch = ids.slice(0, 22);
    for (let i = 0; i < batch.length; i += 4) {
      const chunk = batch.slice(i, i + 4);
      const rows = await Promise.all(
        chunk.map(async (id) => {
          try {
            const data = (await coresignalJson(`/collect/${encodeURIComponent(id)}`)) as Record<
              string,
              unknown
            >;
            return profileFromCoresignal(data);
          } catch {
            return null;
          }
        }),
      );
      for (const row of rows) if (row) out.push(row);
    }
    return out;
  },
};
