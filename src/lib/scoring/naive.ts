import { candidates } from "@/lib/data/candidates";

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9+/# ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/** Plain "here is a JD, rank these" overlap — no ICP, no stuffed penalty. */
export function naiveRank(briefText: string): string[] {
  const needles = tokens(briefText);
  return [...candidates]
    .map((c) => {
      const hay = tokens(
        [c.headline, c.skills.join(" "), c.history.map((r) => `${r.title} ${r.scope}`).join(" ")].join(
          " ",
        ),
      );
      let overlap = 0;
      for (const n of needles) if (hay.has(n)) overlap += 1;
      return { id: c.id, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .map((r) => r.id);
}
