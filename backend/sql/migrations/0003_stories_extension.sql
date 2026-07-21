alter table articles add column if not exists origin text not null default 'crawled';
alter table articles add column if not exists organization_id bigint references organizations(id);
alter table articles add column if not exists created_by_user_id bigint references users(id);
alter table articles add column if not exists journalist_id bigint references journalists(id);
alter table articles add column if not exists body text;
alter table articles add column if not exists body_format text not null default 'markdown';
alter table articles add column if not exists image_caption text;
alter table articles add column if not exists image_credit text;
alter table articles add column if not exists tags text[] not null default '{}';
alter table articles add column if not exists external_url text;
alter table articles add column if not exists slug text;
alter table articles add column if not exists scheduled_publish_at timestamptz;
alter table articles add column if not exists breaking boolean not null default false;
alter table articles add column if not exists developing boolean not null default false;
alter table articles add column if not exists withdrawn_at timestamptz;
alter table articles add column if not exists withdrawn_reason text;
alter table articles add column if not exists source_documents jsonb not null default '[]';
alter table articles add column if not exists featured_in_ecosystem boolean not null default false;

create index if not exists articles_organization_idx on articles(organization_id);
create index if not exists articles_origin_idx on articles(origin);
create index if not exists articles_featured_in_ecosystem_idx on articles(featured_in_ecosystem) where featured_in_ecosystem = true;

create unique index if not exists articles_org_slug_idx on articles(organization_id, slug)
  where organization_id is not null and slug is not null;
create unique index if not exists articles_independent_slug_idx on articles(slug)
  where organization_id is null and slug is not null;

create table if not exists article_corrections (
  id bigserial primary key,
  article_id bigint not null references articles(id) on delete cascade,
  corrected_by_user_id bigint references users(id),
  correction_note text,
  previous_body text,
  previous_headline text,
  corrected_at timestamptz not null default now()
);

create index if not exists article_corrections_article_idx on article_corrections(article_id);
