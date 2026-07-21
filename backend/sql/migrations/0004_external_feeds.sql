create table if not exists external_feed_subscriptions (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  feed_url text not null,
  validated_at timestamptz,
  validation_status text not null default 'pending',
  last_polled_at timestamptz,
  last_error text,
  poll_interval_minutes integer not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists external_feed_subscriptions_org_idx on external_feed_subscriptions(organization_id);

create table if not exists feed_import_rules (
  id bigserial primary key,
  subscription_id bigint not null references external_feed_subscriptions(id) on delete cascade,
  category_id bigint references categories(id),
  publish_mode text not null default 'draft',
  content_mode text not null default 'headline_summary_image',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feed_import_rules_subscription_idx on feed_import_rules(subscription_id);
