-- articles.source_id was NOT NULL under the crawler-only schema (every row came from
-- a `sources` entry). Publisher-authored stories (origin='publisher_authored') and
-- stories imported via a publisher's own external_feed_subscriptions have no
-- corresponding `sources` row, so this must become nullable.
alter table articles alter column source_id drop not null;
