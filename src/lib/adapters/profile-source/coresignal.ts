import type { PeopleSource } from "./types";
import { localSource } from "./local";

/**
 * Coresignal Search is free (IDs only). Collect costs credits — call only on cache misses.
 * Without CORESIGNAL_API_KEY this degrades to the local index (rule 3a).
 */
export const coresignalSource: PeopleSource = {
  name: "coresignal",
  async search(query) {
    if (!process.env.CORESIGNAL_API_KEY) return localSource.search(query);
    throw new Error("Coresignal live client is not wired; unset CORESIGNAL_API_KEY to use local.");
  },
  async collect(ids) {
    if (!process.env.CORESIGNAL_API_KEY) return localSource.collect(ids);
    throw new Error("Coresignal live client is not wired; unset CORESIGNAL_API_KEY to use local.");
  },
};
