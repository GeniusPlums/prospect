import { candidates } from "@/lib/data/candidates";
import type { PeopleSource, SearchHit, CollectedProfile } from "./types";

export const localSource: PeopleSource = {
  name: "local",
  async search() {
    return candidates.map((c) => ({ externalId: c.id, cacheKey: c.id })) as SearchHit[];
  },
  async collect(ids: string[]) {
    const set = new Set(ids);
    return candidates
      .filter((c) => set.has(c.id))
      .map(
        (c): CollectedProfile => ({
          externalId: c.id,
          linkedinUrl: `https://linkedin.com/in/${c.id}`,
          displayName: c.name,
          headline: c.headline,
          city: c.city,
          years: c.years,
          raw: c,
        }),
      );
  },
};
