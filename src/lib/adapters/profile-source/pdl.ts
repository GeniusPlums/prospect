import type { PeopleSource } from "./types";
import { localSource } from "./local";

/** Same interface as Coresignal. Activate by changing active.ts only. */
export const pdlSource: PeopleSource = {
  name: "pdl",
  async search(query) {
    if (!process.env.PDL_API_KEY) return localSource.search(query);
    throw new Error("PDL live client is not wired; unset PDL_API_KEY to use local.");
  },
  async collect(ids) {
    if (!process.env.PDL_API_KEY) return localSource.collect(ids);
    throw new Error("PDL live client is not wired; unset PDL_API_KEY to use local.");
  },
};
