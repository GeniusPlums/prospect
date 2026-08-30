-- Prospect product schema. Snake_case. Org-scoped people; global companies.
-- Embeddings stored as jsonb (float[]) so PGLite and Neon both boot.
-- db.ts attempts CREATE EXTENSION vector + HNSW when the engine supports it.

create table if not exists org (
  id text primary key,
  clerk_org_id text unique,
  name text not null,
  plan text not null default 'free',
  razorpay_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists org_rule_version (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  version int not null,
  author_type text not null check (author_type in ('user', 'system')),
  accepted_at timestamptz,
  must jsonb not null default '[]',
  nice jsonb not null default '[]',
  disqualifiers jsonb not null default '[]',
  note text,
  created_at timestamptz not null default now(),
  unique (org_id, version)
);

create table if not exists icp_version (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  role_key text not null,
  version int not null,
  parent_id text references icp_version (id),
  author_type text not null check (author_type in ('user', 'system')),
  accepted_at timestamptz,
  title text not null,
  summary text not null default '',
  seniority text not null default 'senior',
  years_min int not null default 0,
  years_max int not null default 40,
  locations jsonb not null default '[]',
  company_kinds jsonb not null default '[]',
  skills jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (org_id, role_key, version)
);

create table if not exists icp_criterion (
  id text primary key,
  icp_version_id text not null references icp_version (id) on delete cascade,
  kind text not null check (kind in ('must', 'nice', 'disqualifier')),
  body text not null,
  machine_spec jsonb not null default '{}',
  position int not null default 0
);

create index if not exists icp_criterion_version_idx on icp_criterion (icp_version_id);

create table if not exists company (
  id text primary key,
  name text not null,
  kind text not null,
  city text not null default ''
);

create table if not exists company_snapshot (
  id text primary key,
  company_id text not null references company (id) on delete cascade,
  year int not null,
  stage text not null,
  headcount int not null default 0,
  signal text not null default '',
  unique (company_id, year)
);

create table if not exists profile_source (
  id text primary key,
  provider text not null,
  external_id text not null,
  candidate_id text,
  linkedin_url text,
  payload_blob_url text,
  raw_hash text,
  collected_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists candidate (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  display_name text not null,
  headline text not null default '',
  city text not null default '',
  years int not null default 0,
  linkedin_url text,
  notice_period_days int not null default 30,
  visa text not null default '',
  expected_comp jsonb,
  stuffed boolean not null default false,
  tenure text not null default 'stable',
  embedding jsonb,
  merge_confidence real,
  created_at timestamptz not null default now()
);

create index if not exists candidate_org_idx on candidate (org_id);
create index if not exists candidate_linkedin_idx on candidate (linkedin_url);

create table if not exists experience (
  id text primary key,
  candidate_id text not null references candidate (id) on delete cascade,
  company_id text not null references company (id),
  title text not null,
  start_year int not null,
  end_year int,
  scope text not null default '',
  position int not null default 0
);

create table if not exists signal (
  id text primary key,
  candidate_id text not null references candidate (id) on delete cascade,
  kind text not null,
  body text not null,
  provenance_url text not null,
  confidence real not null default 0.7,
  extracted_at timestamptz not null default now()
);

create index if not exists signal_candidate_idx on signal (candidate_id);

create table if not exists search_run (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  icp_version_id text not null references icp_version (id),
  status text not null default 'running',
  brief_text text not null default '',
  cache_hits int not null default 0,
  cache_misses int not null default 0,
  profiles_charged int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists pipeline_event (
  id text primary key,
  search_run_id text not null references search_run (id) on delete cascade,
  step text not null,
  message text not null,
  counts jsonb,
  at timestamptz not null default now()
);

create index if not exists pipeline_event_run_idx on pipeline_event (search_run_id, at);

create table if not exists candidate_score (
  id text primary key,
  search_run_id text not null references search_run (id) on delete cascade,
  candidate_id text not null references candidate (id),
  icp_version_id text not null,
  model_version text not null,
  prompt_version text not null,
  case_for text not null default '',
  case_against text not null default '',
  unclear jsonb not null default '[]',
  verdict text not null default 'mixed',
  disqualified boolean not null default false,
  disqualifier_flags jsonb not null default '[]',
  for_weight real not null default 0,
  against_weight real not null default 0,
  unclear_weight real not null default 0,
  stage1_rank int,
  final_rank int,
  held_back boolean not null default false,
  held_back_rules jsonb not null default '[]',
  unique (search_run_id, candidate_id)
);

create table if not exists criterion_grade (
  id text primary key,
  candidate_score_id text not null references candidate_score (id) on delete cascade,
  criterion_id text not null,
  grade text not null check (grade in ('strong_yes', 'yes', 'unclear', 'no', 'strong_no')),
  evidence text not null default ''
);

create table if not exists reviewer_objection (
  id text primary key,
  candidate_score_id text not null references candidate_score (id) on delete cascade,
  claim text not null,
  objection text not null
);

create table if not exists enrichment_attempt (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  candidate_id text not null,
  search_run_id text,
  provider text not null,
  cost_usd real not null default 0,
  outcome text not null,
  created_at timestamptz not null default now()
);

create table if not exists reveal (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  search_run_id text not null,
  candidate_id text not null,
  email text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (search_run_id, candidate_id)
);

create table if not exists outreach (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  search_run_id text not null,
  candidate_id text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  personalization_facts jsonb not null default '[]',
  sent_at timestamptz,
  via text
);

create table if not exists feedback (
  search_run_id text not null references search_run (id) on delete cascade,
  candidate_id text not null,
  vote text not null check (vote in ('up', 'down')),
  tags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (search_run_id, candidate_id)
);

create table if not exists usage_ledger (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  usage_type text not null,
  quantity int not null,
  cycle text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_ledger_org_cycle_idx on usage_ledger (org_id, cycle, usage_type);

create table if not exists razorpay_subscription (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  razorpay_subscription_id text not null unique,
  plan text not null,
  cycle_anchor date not null,
  status text not null default 'active'
);

create table if not exists razorpay_addon_push (
  id text primary key,
  subscription_id text not null,
  cycle text not null,
  usage_type text not null,
  quantity int not null,
  amount_paise int not null,
  pushed_at timestamptz not null default now(),
  unique (subscription_id, cycle, usage_type)
);

create table if not exists billing_reconciliation (
  id text primary key,
  org_id text not null,
  cycle text not null,
  usage_type text not null,
  ledger_quantity int not null,
  addon_quantity int not null,
  unique (org_id, cycle, usage_type)
);

create table if not exists golden_set (
  id text primary key,
  name text not null,
  brief_text text not null,
  icp_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists golden_judgment (
  golden_set_id text not null references golden_set (id) on delete cascade,
  candidate_id text not null,
  human_rank int not null,
  relevant boolean not null default true,
  primary key (golden_set_id, candidate_id)
);

create table if not exists eval_run (
  id text primary key,
  model_version text not null,
  prompt_version text not null,
  ndcg10 real,
  p_at_5 real,
  disqualifier_recall real,
  rubric_p_at_5 real,
  naive_p_at_5 real,
  passed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists eval_run_metric (
  eval_run_id text not null references eval_run (id) on delete cascade,
  golden_set_id text not null,
  ndcg10 real,
  p_at_5 real,
  disqualifier_recall real,
  primary key (eval_run_id, golden_set_id)
);

create table if not exists application (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  icp_version_id text not null,
  candidate_id text,
  resume_text text not null,
  source text not null default 'inbound',
  created_at timestamptz not null default now()
);

create table if not exists ats_connection (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  provider text not null default 'merge',
  status text not null default 'connected',
  created_at timestamptz not null default now()
);

create table if not exists ats_person (
  id text primary key,
  ats_connection_id text not null references ats_connection (id) on delete cascade,
  merge_id text,
  candidate_id text,
  name text not null,
  stage text not null default 'applied',
  outcome text
);

create table if not exists ats_event (
  id text primary key,
  ats_person_id text not null references ats_person (id) on delete cascade,
  kind text not null,
  payload jsonb,
  at timestamptz not null default now()
);

create table if not exists ats_write (
  id text primary key,
  ats_connection_id text not null,
  candidate_id text not null,
  op text not null,
  payload jsonb,
  at timestamptz not null default now()
);

create table if not exists automation (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  trigger text not null,
  action text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists saved_search (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  icp_version_id text not null,
  always_on boolean not null default false,
  last_run_at timestamptz
);

create table if not exists insight (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  kind text not null,
  body text not null,
  visible boolean not null default false,
  created_at timestamptz not null default now()
);

insert into org (id, clerk_org_id, name, plan)
values ('org_local', 'org_local', 'Local workspace', 'pro')
on conflict (id) do nothing;
