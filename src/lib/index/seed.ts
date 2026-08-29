import { sql } from "@/lib/db";
import { companies } from "@/lib/data/companies";
import { candidates } from "@/lib/data/candidates";
import { embedText } from "@/lib/embed";
import { DEV_ORG } from "@/lib/ids";
import { GOLDEN_SETS } from "@/lib/eval/golden";

function provenance(kind: string, candidateId: string): string {
  return `local://fixture/${candidateId}/${kind}`;
}

export async function seedIfEmpty(): Promise<void> {
  const rows = await sql<{ n: string }>(`SELECT count(*)::text as n FROM candidate`);
  if (Number(rows[0]?.n ?? 0) > 0) return;

  for (const company of Object.values(companies)) {
    await sql(
      `INSERT INTO company (id, name, kind, city) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [company.id, company.name, company.kind, company.city],
    );
    for (const snap of company.snapshots) {
      await sql(
        `INSERT INTO company_snapshot (id, company_id, year, stage, headcount, signal)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (company_id, year) DO NOTHING`,
        [`${company.id}-${snap.year}`, company.id, snap.year, snap.stage, snap.headcount, snap.signal],
      );
    }
  }

  for (const person of candidates) {
    const hay = [
      person.headline,
      person.city,
      person.skills.join(" "),
      person.history.map((r) => `${r.title} ${r.scope}`).join(" "),
      person.talks.map((t) => t.title).join(" "),
      person.writing.map((w) => w.title).join(" "),
      person.github?.languages.join(" ") ?? "",
    ].join(" ");
    await sql(
      `INSERT INTO candidate (
        id, org_id, display_name, headline, city, years, linkedin_url,
        notice_period_days, visa, expected_comp, stuffed, tenure, embedding, merge_confidence
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
      ON CONFLICT (id) DO NOTHING`,
      [
        person.id,
        DEV_ORG,
        person.name,
        person.headline,
        person.city,
        person.years,
        `https://linkedin.com/in/${person.id}`,
        person.noticePeriodDays,
        person.visa,
        person.expectedLpa != null ? JSON.stringify({ amount: person.expectedLpa, currency: "INR", unit: "LPA" }) : null,
        person.stuffed,
        person.tenure,
        JSON.stringify(embedText(hay)),
        1,
      ],
    );
    await sql(
      `INSERT INTO profile_source (id, provider, external_id, candidate_id, linkedin_url, raw_hash)
       VALUES ($1,'local',$2,$2,$3,$4) ON CONFLICT (provider, external_id) DO NOTHING`,
      [`ps_${person.id}`, person.id, `https://linkedin.com/in/${person.id}`, person.id],
    );

    for (let i = 0; i < person.history.length; i += 1) {
      const role = person.history[i]!;
      await sql(
        `INSERT INTO experience (id, candidate_id, company_id, title, start_year, end_year, scope, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [`exp_${person.id}_${i}`, person.id, role.companyId, role.title, role.start, role.end, role.scope, i],
      );
    }

    const signals: { kind: string; body: string; url: string }[] = [
      { kind: "headline", body: person.headline, url: provenance("headline", person.id) },
      { kind: "skills", body: person.skills.join(", "), url: provenance("skills", person.id) },
      {
        kind: "education",
        body: `${person.education.degree}, ${person.education.school}`,
        url: provenance("education", person.id),
      },
    ];
    if (person.github) {
      signals.push({
        kind: "github",
        body: `@${person.github.handle} ${person.github.contributions12m}/12m ${person.github.languages.join("/")} ${person.github.repos.map((r) => r.name).join(", ")}`,
        url: `https://github.com/${person.github.handle}`,
      });
    }
    for (const talk of person.talks) {
      signals.push({
        kind: "talk",
        body: `${talk.title} — ${talk.venue} ${talk.year}`,
        url: provenance("talk", person.id),
      });
    }
    for (const writing of person.writing) {
      signals.push({
        kind: "writing",
        body: `${writing.title} (${writing.year})`,
        url: provenance("writing", person.id),
      });
    }
    for (const [i, sig] of signals.entries()) {
      await sql(
        `INSERT INTO signal (id, candidate_id, kind, body, provenance_url, confidence)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [`sig_${person.id}_${i}`, person.id, sig.kind, sig.body, sig.url, 0.9],
      );
    }
  }

  for (const set of GOLDEN_SETS) {
    await sql(
      `INSERT INTO golden_set (id, name, brief_text, icp_snapshot) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING`,
      [set.id, set.name, set.briefText, JSON.stringify(set.icp)],
    );
    for (const j of set.judgments) {
      await sql(
        `INSERT INTO golden_judgment (golden_set_id, candidate_id, human_rank, relevant) VALUES ($1,$2,$3,$4)
         ON CONFLICT (golden_set_id, candidate_id) DO NOTHING`,
        [set.id, j.candidateId, j.humanRank, j.relevant],
      );
    }
  }
}
