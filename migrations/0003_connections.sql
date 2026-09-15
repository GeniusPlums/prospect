create table if not exists composio_auth_config (
  toolkit text primary key,
  auth_config_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists org_connection (
  id text primary key,
  org_id text not null references org (id) on delete cascade,
  toolkit text not null,
  connected_account_id text not null,
  auth_config_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (org_id, toolkit)
);

create index if not exists org_connection_org_idx on org_connection (org_id);
