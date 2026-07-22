alter table story_clusters add column if not exists canonical_url text;
alter table story_clusters add column if not exists normalized_headline text;
alter table story_clusters add column if not exists publisher_identity_key text;

create index if not exists story_clusters_canonical_url_idx on story_clusters(canonical_url) where canonical_url is not null;
create index if not exists story_clusters_publisher_identity_idx on story_clusters(publisher_identity_key, normalized_headline)
  where publisher_identity_key is not null;

alter table articles add column if not exists dedup_fingerprint text;
create index if not exists articles_dedup_fingerprint_idx on articles(dedup_fingerprint) where dedup_fingerprint is not null;
