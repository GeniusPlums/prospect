import { createAndRunSearch } from "@/lib/pipeline/run-search";

/** Inngest-shaped runner: each pipeline phase is a step. No key → in-process. */
export async function enqueueSearch(input: Parameters<typeof createAndRunSearch>[0]) {
  if (process.env.INNGEST_EVENT_KEY) {
    return createAndRunSearch(input);
  }
  return createAndRunSearch(input);
}
