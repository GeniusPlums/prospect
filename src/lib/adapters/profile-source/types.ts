export type SearchHit = { externalId: string; cacheKey: string };

export type CollectedProfile = {
  externalId: string;
  linkedinUrl: string;
  displayName: string;
  headline: string;
  city: string;
  years: number;
  raw: unknown;
};

export type PeopleSource = {
  name: "local" | "coresignal" | "pdl";
  search(query: Record<string, unknown>): Promise<SearchHit[]>;
  collect(ids: string[]): Promise<CollectedProfile[]>;
};
