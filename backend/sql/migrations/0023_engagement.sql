-- Engagement for registered 256 Newsroom journalists & publishers:
-- follow publishers/journalists, like/upvote articles, comment on articles.

create table if not exists publisher_follows (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  organization_id bigint references organizations(id) on delete cascade,
  journalist_id bigint references journalists(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint publisher_follows_target_chk check (
    (organization_id is not null and journalist_id is null)
    or (organization_id is null and journalist_id is not null)
  )
);

create unique index if not exists publisher_follows_user_org_uidx
  on publisher_follows (user_id, organization_id)
  where organization_id is not null;

create unique index if not exists publisher_follows_user_journalist_uidx
  on publisher_follows (user_id, journalist_id)
  where journalist_id is not null;

create index if not exists publisher_follows_org_idx on publisher_follows (organization_id);
create index if not exists publisher_follows_journalist_idx on publisher_follows (journalist_id);

create table if not exists article_likes (
  id bigserial primary key,
  article_id bigint not null references articles(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index if not exists article_likes_article_idx on article_likes (article_id);

create table if not exists article_upvotes (
  id bigserial primary key,
  article_id bigint not null references articles(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index if not exists article_upvotes_article_idx on article_upvotes (article_id);

create table if not exists article_comments (
  id bigserial primary key,
  article_id bigint not null references articles(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  body text not null,
  parent_id bigint references article_comments(id) on delete cascade,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists article_comments_article_idx on article_comments (article_id, created_at desc);
create index if not exists article_comments_user_idx on article_comments (user_id);
