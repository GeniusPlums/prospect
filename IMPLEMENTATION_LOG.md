# Implementation log

## 2026-08-29 — Demo to product (build spec)

**What changed.** Replaced the theatre pipeline and Zustand-as-source-of-truth with a Postgres-backed chain: schema + eval harness first, surface-agnostic ICP versions, `profile_source` adapters (local / Coresignal / PDL swap file), cache-before-collect ingest, rubric scoring + Bradley-Terry, non-blocking reviewer, paper/navy UI, feedback re-rank from stage 1, reveal waterfall, Merge ATS + same-ICP screening, billing meter + cron, empty-but-complete precision dashboards.

**Why.** Acquisition once (warm index); enrichment on click only. TanStack Start kept (Inngest-shaped steps, no maxDuration migration).

**Tested.** `npm run eval` (NDCG@10 ≈ 0.92, P@5 0.70, disqualifier recall 1.0). `tsx --test` eval, icp, adapters, billing, pipeline (warm-index collect = 0). `tsc --noEmit` clean.

**Flags.** Rubric P@5 **ties** the naive JD-overlap baseline (0.70), not a clear win; `ml-ranking` gold P@5 is 0.4. Clerk is `org_local` until keys exist. Live Coresignal/Firecrawl/Nango/Razorpay/Merge HTTP degrade to local adapters. Inbox screening expects an `icp_version` id (not a search-run id).
