import { sql, sqlOne } from "@/lib/db";
import { embedText } from "@/lib/embed";
import { nid } from "@/lib/ids";
import type { CollectedProfile } from "@/lib/adapters/profile-source/types";

function extraSignalBody(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const rec = raw as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["summary", "about", "bio", "skills", "experience", "headline", "title", "location"]) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
    else if (Array.isArray(value)) {
      const joined = value
        .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? JSON.stringify(item) : ""))
        .filter(Boolean)
        .join("; ");
      if (joined) parts.push(joined);
    }
  }
  return parts.join("\n").slice(0, 4000);
}

export async function persistCollected(
  orgId: string,
  profiles: CollectedProfile[],
  provider: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const profile of profiles) {
    const existingSource = await sqlOne<{ candidate_id: string | null }>(
      `SELECT candidate_id FROM profile_source WHERE provider=$1 AND external_id=$2`,
      [provider, profile.externalId],
    );
    if (existingSource?.candidate_id) {
      ids.push(existingSource.candidate_id);
      continue;
    }
    const existingCandidate = await sqlOne<{ id: string }>(`SELECT id FROM candidate WHERE id=$1`, [
      profile.externalId,
    ]);
    const candidateId = existingCandidate?.id ?? nid("can");
    if (!existingCandidate) {
      const hay = [profile.displayName, profile.headline, profile.city, String(profile.years)].join(" ");
      await sql(
        `INSERT INTO candidate (
          id, org_id, display_name, headline, city, years, linkedin_url, embedding, merge_confidence
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        ON CONFLICT (id) DO NOTHING`,
        [
          candidateId,
          orgId,
          profile.displayName,
          profile.headline,
          profile.city,
          profile.years,
          profile.linkedinUrl || null,
          JSON.stringify(embedText(hay)),
          0.7,
        ],
      );
      const provenance = profile.linkedinUrl || `composio://${provider}/${profile.externalId}`;
      await sql(
        `INSERT INTO signal (id, candidate_id, kind, body, provenance_url, confidence)
         VALUES ($1,$2,'headline',$3,$4,0.8)
         ON CONFLICT (id) DO NOTHING`,
        [`sig_${candidateId}_0`, candidateId, profile.headline || profile.displayName, provenance],
      );
      const extra = extraSignalBody(profile.raw);
      if (extra) {
        await sql(
          `INSERT INTO signal (id, candidate_id, kind, body, provenance_url, confidence)
           VALUES ($1,$2,'dossier',$3,$4,0.6)
           ON CONFLICT (id) DO NOTHING`,
          [`sig_${candidateId}_1`, candidateId, extra, provenance],
        );
      }
    }
    await sql(
      `INSERT INTO profile_source (id, provider, external_id, candidate_id, linkedin_url, raw_hash)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider, external_id) DO NOTHING`,
      [
        nid("ps"),
        provider,
        profile.externalId,
        candidateId,
        profile.linkedinUrl || null,
        profile.externalId,
      ],
    );
    ids.push(candidateId);
  }
  return ids;
}
