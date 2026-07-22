-- Publisher news subscribers + broadcast updates (articles, press releases, etc.)

create table if not exists publisher_subscribers (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id bigint references users(id) on delete cascade,
  email text,
  display_name text,
  active boolean not null default true,
  source text not null default 'follow', -- follow | public_form | dashboard
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint publisher_subscribers_identity_chk check (
    user_id is not null or (email is not null and length(trim(email)) > 3)
  )
);

-- One row per user/email per org (reactivate instead of inserting duplicates)
create unique index if not exists publisher_subscribers_org_user_uidx
  on publisher_subscribers (organization_id, user_id)
  where user_id is not null;

create unique index if not exists publisher_subscribers_org_email_uidx
  on publisher_subscribers (organization_id, lower(email))
  where email is not null and user_id is null;

create index if not exists publisher_subscribers_org_idx
  on publisher_subscribers (organization_id, active, subscribed_at desc);

create table if not exists publisher_broadcasts (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  created_by_user_id bigint references users(id) on delete set null,
  kind text not null default 'update'
    check (kind in ('article', 'press_release', 'update', 'newsletter')),
  subject text not null,
  body text not null,
  article_id bigint references articles(id) on delete set null,
  link_url text,
  recipient_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists publisher_broadcasts_org_idx
  on publisher_broadcasts (organization_id, created_at desc);

create table if not exists publisher_broadcast_deliveries (
  id bigserial primary key,
  broadcast_id bigint not null references publisher_broadcasts(id) on delete cascade,
  subscriber_id bigint references publisher_subscribers(id) on delete set null,
  user_id bigint references users(id) on delete set null,
  email text,
  status text not null default 'queued'
    check (status in ('queued', 'inbox', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists publisher_broadcast_deliveries_broadcast_idx
  on publisher_broadcast_deliveries (broadcast_id);

create index if not exists publisher_broadcast_deliveries_user_idx
  on publisher_broadcast_deliveries (user_id, created_at desc)
  where user_id is not null;
