-- Automated 256 Ecosystem Content Publisher: schema for source configuration,
-- evidence retention, generation job auditing, and per-platform automation
-- settings. No AI calls or scraping happen from this migration alone.

create table if not exists automation_settings (
  id bigserial primary key,
  organization_id bigint not null unique references organizations(id) on delete cascade,
  mode text not null default 'draft', -- automatic | draft | manual | paused
  daily_target integer not null default 2,
  daily_max integer not null default 2,
  publish_times jsonb not null default '["09:00","15:00"]',
  active_days jsonb not null default '["mon","tue","wed","thu","fri","sat","sun"]',
  timezone text not null default 'Africa/Kampala',
  min_interval_minutes integer not null default 120,
  content_rotation jsonb not null default '{}',
  eligible_content_types jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approved_domains (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  domain text not null,
  active boolean not null default true,
  added_by_user_id bigint references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, domain)
);

create table if not exists platform_sources (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  url text not null,
  label text,
  content_type_hint text,
  active boolean not null default true,
  added_by_user_id bigint references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, url)
);

create table if not exists excluded_urls (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  url_pattern text not null,
  reason text,
  added_by_user_id bigint references users(id),
  created_at timestamptz not null default now()
);

create table if not exists source_evidence (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  source_url text not null,
  canonical_url text,
  source_page_title text,
  content_hash text not null,
  raw_text_snapshot text,
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists source_evidence_org_idx on source_evidence(organization_id);
create index if not exists source_evidence_hash_idx on source_evidence(content_hash);
create index if not exists source_evidence_url_idx on source_evidence(source_url);

create table if not exists generation_jobs (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  source_evidence_id bigint references source_evidence(id),
  article_id bigint references articles(id),
  status text not null default 'discovered',
  -- discovered | processing | awaiting_verification | draft_ready | published
  -- | rejected | failed | skipped_duplicate
  error text,
  generation_model text,
  triggered_by text not null default 'automation', -- automation | user id string for manual retry
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists generation_jobs_org_idx on generation_jobs(organization_id);
create index if not exists generation_jobs_status_idx on generation_jobs(status);

alter table articles add column if not exists content_type text;
alter table articles add column if not exists ecosystem_organization_id bigint references organizations(id);
alter table articles add column if not exists source_domain text;
alter table articles add column if not exists source_page_title text;
alter table articles add column if not exists source_content_hash text;
alter table articles add column if not exists ai_generation_status text;
alter table articles add column if not exists fact_verification_status text;
alter table articles add column if not exists generation_model text;
alter table articles add column if not exists generation_job_id bigint references generation_jobs(id);
alter table articles add column if not exists automation_rule_id bigint references automation_settings(id);
alter table articles add column if not exists discovered_at timestamptz;
alter table articles add column if not exists generated_at timestamptz;
alter table articles add column if not exists withdrawn_by_user_id bigint references users(id);
alter table articles add column if not exists rejected_at timestamptz;
alter table articles add column if not exists rejected_by_user_id bigint references users(id);
alter table articles add column if not exists rejected_reason text;
alter table articles add column if not exists archived_at timestamptz;

create index if not exists articles_source_content_hash_idx on articles(source_content_hash) where source_content_hash is not null;
create index if not exists articles_ecosystem_org_idx on articles(ecosystem_organization_id) where ecosystem_organization_id is not null;
