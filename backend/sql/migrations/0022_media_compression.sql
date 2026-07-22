-- Video (and optional image) compression status for uploaded media.
alter table media_assets
  add column if not exists processing_status text not null default 'ready',
  add column if not exists original_size_bytes bigint,
  add column if not exists compressed_size_bytes bigint,
  add column if not exists original_storage_path text,
  add column if not exists compression_error text,
  add column if not exists compressed_at timestamptz;

-- processing_status: ready | processing | failed | skipped
create index if not exists media_assets_processing_status_idx
  on media_assets (processing_status)
  where processing_status = 'processing';
