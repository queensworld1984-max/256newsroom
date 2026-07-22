-- Full audio attachments and short sound bites on publisher-authored stories.
alter table articles
  add column if not exists audio_url text,
  add column if not exists soundbite_url text,
  add column if not exists audio_title text,
  add column if not exists soundbite_title text;

-- Optional link from soundbite media row back to source audio asset.
alter table media_assets
  add column if not exists parent_media_id bigint references media_assets(id) on delete set null,
  add column if not exists duration_seconds numeric;

create index if not exists media_assets_parent_idx on media_assets (parent_media_id);
