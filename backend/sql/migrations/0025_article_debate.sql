-- Per-article debate: one agree/disagree stance per user, with required reason.
-- Scoped to articles only (not publisher profiles).

create table if not exists article_debate_stances (
  id bigserial primary key,
  article_id bigint not null references articles(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  stance text not null check (stance in ('agree', 'disagree')),
  reason text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index if not exists article_debate_stances_article_idx
  on article_debate_stances (article_id, stance, created_at desc);

create index if not exists article_debate_stances_user_idx
  on article_debate_stances (user_id);
