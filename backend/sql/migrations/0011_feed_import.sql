-- External RSS connect + auto-import support.
alter table external_feed_subscriptions add column if not exists domain_verification_token text;
alter table external_feed_subscriptions add column if not exists domain_verified_at timestamptz;
-- Lets an admin unlock auto-publish for a specific feed even if the owning
-- organization isn't (yet) an approved publisher — see "administrative
-- override" in feeds.js. Distinct from org verification_status, which is
-- the normal path to unlocking auto-publish.
alter table external_feed_subscriptions add column if not exists admin_auto_publish_override boolean not null default false;
alter table external_feed_subscriptions add column if not exists created_by_user_id bigint references users(id);

alter table feed_import_rules add column if not exists district_id bigint references districts(id);

alter table articles add column if not exists feed_subscription_id bigint references external_feed_subscriptions(id);
create index if not exists articles_feed_subscription_idx on articles(feed_subscription_id) where feed_subscription_id is not null;

create table if not exists feed_import_logs (
  id bigserial primary key,
  subscription_id bigint not null references external_feed_subscriptions(id) on delete cascade,
  status text not null default 'running',
  items_found integer,
  items_imported integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists feed_import_logs_subscription_idx on feed_import_logs(subscription_id);
