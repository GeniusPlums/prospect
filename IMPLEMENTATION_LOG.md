# Implementation log

## 2026-09-16 — Paper desk, not vibe-coded SaaS

**What changed.** Restyled the live app against Yakko’s “vibe-coded website” process: a product metaphor (junior-recruiter desk / gazette) that the whole site shares, not a unique asset on a generic template. Paper cream, navy ink, vermillion stamp; Newsreader + Source Serif; sharp edges; slim Source/Searches/Connections nav with More. Landing is editorial (no feature-grid hero). Unsigned landing paints immediately. Connections is a ledger with dashed empty/error/sign-in states. Honest-ux-journey canvas screens match. No Composio in UI copy.

**Why.** Founder called the current design slop. Typical LLM chrome (Inter, pills, 9-item nav, identical rounded cards) fights the original paper/navy India-first art direction.

**Tested.** `npx tsc --noEmit`; `npm test` (38 pass, 1 skip). Local `/` and `/connections` return 200; landing copy is “Fewer people. A case for each.” Connections signed-out empty is a dashed sign-in panel. IDE browser MCP could not attach a tab; verified via HTTP + HTML. No Prospect Playwright suite in this repo (`pnpm e2e:full` is Astrazen-only).

## 2026-09-16 — Prove catalog, OAuth, and tool calls (or fail honestly)

**What changed.** Catalog lists hiring-lane tools via `toolkits.get({category,limit,cursor})`. The SDK returns a bare array and drops `next_cursor`; we stopped paging with the last slug (that was `Failed to fetch toolkits`). Connect only offers hosted OAuth when the toolkit has managed auth; otherwise the row shows `No hosted OAuth for this tool`. After sign-in, lanes are runnable only if we can load the tool list, pick a matching tool, and bind required fields from the real JSON schema — no needle-guessed slug and no dumped argument bag. Source / reveal / send / ATS stay closed when that bind fails. Product copy does not say Composio.

**Why.** OAuth “connected” was a lie if we could not call a people-search / chat / send / ATS tool with valid args.

**Tested.** `npm test` (schema bind: aliases, missing required, people-search vs send-email; catalog: no slug-as-cursor, no DevOps, no hosted OAuth when managed auth is empty). `npx tsc --noEmit`. Live COMPOSIO_API_KEY pull from Vercel CLI came back empty locally, so production catalog is proven by the pagination fix + deploy, not a local live hit.

## 2026-09-16 — Honest UX journey (Connect-first)

**What changed.** After sign-up the first product screen is Connections (live Composio hiring lanes only: LLM, sourcing/people, ATS/HRIS, outreach/mail — no Popular, no DevOps). Source is locked until a people toolkit is connected; role/ICP stay closed and the 36-person eval fixtures are never shown to user orgs. Home CTA is **Find a shortlist**. Finding names the toolkit, logs cache vs collect vs spend, and never writes “warm index hit” on an empty search. Reveal/send/ATS stay gated on those lanes. Groq is labeled as last-resort fallback when no LLM is connected. Tester lies removed: always-on (log-only), ATS write of `aditya-iyer`, dashboard calibration static copy, Rules toast for vote-proposed ICPs.

**Why.** Prospect is the harness. Users connect tools; empty is allowed.

**Tested.** `npm test` (lock empty source without toolkit; catalog lanes exclude Popular/DevOps; Hunter is outreach not search; user orgs do not rank fixtures; empty search events omit warm-index). `npx tsc --noEmit`.

## 2026-09-16 — Live hiring Connections (no Popular lie)

**What changed.** Connections fetches the real Composio toolkit catalog (`toolkits.list` / `toolkits.get` query, not category chips as a fake list). “Popular” is not a Prospect filter — Composio’s Popular/DevOps/cloud/database categories are dropped. The page groups live results into LLM, sourcing/people, ATS/HRIS, and outreach, with search. Connect calls `startConnect` and redirects to hosted OAuth or shows the real error. Catalog failure renders “Could not load Composio catalog” plus the error, never a dummy list. Runtime picks the first connected toolkit in a lane (category + keywords, not a slug allowlist). Home search stays locked until a sourcing toolkit is connected.

**Why.** The previous UI treated Composio category pills (including Popular) as the product. Clicking them only toggled chips when the toolkit list parse failed or returned empty.

**Tested.** `npm test` (catalog include ATS/LLM, exclude github/docker/kubernetes even when Popular is first; extractToolkitRows ignores a single-toolkit retrieve). `npx tsc --noEmit`.


## 2026-08-29 — Demo to product (build spec)

**What changed.** Replaced the theatre pipeline and Zustand-as-source-of-truth with a Postgres-backed chain: schema + eval harness first, surface-agnostic ICP versions, `profile_source` adapters (local / Coresignal / PDL swap file), cache-before-collect ingest, rubric scoring + Bradley-Terry, non-blocking reviewer, paper/navy UI, feedback re-rank from stage 1, reveal waterfall, Merge ATS + same-ICP screening, billing meter + cron, empty-but-complete precision dashboards.

**Why.** Acquisition once (warm index); enrichment on click only. TanStack Start kept (Inngest-shaped steps, no maxDuration migration).

**Tested.** `npm run eval` (NDCG@10 ≈ 0.92, P@5 0.70, disqualifier recall 1.0). `tsx --test` eval, icp, adapters, billing, pipeline (warm-index collect = 0). `tsc --noEmit` clean.

**Flags.** Rubric P@5 **ties** the naive JD-overlap baseline (0.70), not a clear win; `ml-ranking` gold P@5 is 0.4. Clerk is `org_local` until keys exist. Live Coresignal/Firecrawl/Nango/Razorpay/Merge HTTP degrade to local adapters. Inbox screening expects an `icp_version` id (not a search-run id).

## 2026-08-30 — Production ship

**What changed.** Merged [PR #1](https://github.com/GeniusPlums/prospect/pull/1) to `main`. Provisioned Neon project `prospect` (`patient-cherry-14079106`, `aws-ap-southeast-1`) and applied `0002_prospect.sql`. Linked Vercel project `prospect`, set `DATABASE_URL` (pooled) and `PROSPECT_PEOPLE_PROVIDER=local`. First prod build failed on a missing PWA template; added `scripts/install-page.html` and redeployed.

**Why.** Put the cached sourcing product on a real Postgres + Vercel production URL.

**Tested.** `vercel --prod` Ready. Production alias `https://prospect-chi-lyart.vercel.app` returns 200 for `/`, `/searches`, `/evals`, `/dashboard`, `/settings`, `/inbox`, `/ats`, `/rules`. Deploy build ran `db:migrate` (up to date).

## 2026-08-30 — Unstick production clicks

**What changed.** Homepage sample roles are real `/?sample=` links (work before hydration). `startFromBrief` only creates the run; the search page runs the pipeline and polls. Score / criterion / objection / ICP criteria writes are batched (`insertMany`). Runtime Postgres skips migrate + `CREATE EXTENSION` (those run at deploy). PGlite is a dynamic import.

**Why.** A production search took 37s of sequential IAD→Singapore round-trips, so “Find 22 people” looked frozen. Sample cards were SSR buttons with no `href`, so clicks before hydration did nothing.

**Tested.** `npm test` (eval, icp, pipeline split/idempotent, billing, adapters, insertMany). `npm run typecheck`. `npm run eval`.

## 2026-09-15 — Auth, Composio, Groq, Langfuse

**What changed.** Better Auth email/password with org-scoped searches (`org_<userId>`). Warm index stays `org_local` and is visible to every workspace. Composio hosted OAuth on `/connections` for ATS, sourcing, and outreach; collect persists cache misses; reveal/send/ATS write no-op without a live connection (no invented `@example.com`). Briefs go through Groq with Langfuse traces. Secrets stay in Vercel, not git.

**Why.** Ship the product path the brief asked for: real auth, real connectors, real LLM, Postgres as the meter.

**Tested.** `npm test` (20 pass: eval, icp, pipeline cache-hit, billing, adapters waterfall, insertMany, extractJson, composio parse). `npx tsc --noEmit`. `npm run eval` (NDCG@10 ≈ 0.92, P@5 0.70, disqualifier recall 1.0).

## 2026-09-16 — User-owned Composio catalog (no shortlist)

**What changed.** Connections lists every Composio toolkit from the API (paginated, grouped by Composio category). Runtime resolves LLM / sourcing / ATS / outreach by category + connected tool needles, not a slug allowlist. Production search ranks collected DB dossiers only; the 36-person fixture index stays `org_local` eval/dev. Groq is last-resort when no LLM is connected. Cache-before-collect, quota-gated collect, no invented emails.

**Why.** Prospect is the harness. Users connect whatever they already have on Composio; we do not sell Coresignal or limit the catalog to examples.

**Tested.** `npm test` (eval, icp, pipeline cache-hit + empty user-org, billing, adapters quota/waterfall, insertMany, extractJson, catalog roles, composio parse). `npx tsc --noEmit`. `npm run eval`. Production alias `https://prospect-chi-lyart.vercel.app` deployed from `ready-to-ship` (`e192d20`). Connections lists Composio’s catalog; signed-in searches no longer rank the 36-person eval fixtures.

