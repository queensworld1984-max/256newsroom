-- Supports the publisher dashboard: editorial approval step between
-- pending_review and schedule/publish, and an org-scoped media asset library
-- (URL-based — there is no file upload/object storage integration yet).
alter table articles add column if not exists approved_at timestamptz;
alter table articles add column if not exists approved_by_user_id bigint references users(id);

create table if not exists media_assets (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  url text not null,
  caption text,
  credit text,
  alt_text text,
  added_by_user_id bigint references users(id),
  created_at timestamptz not null default now()
);

create index if not exists media_assets_organization_idx on media_assets(organization_id);
