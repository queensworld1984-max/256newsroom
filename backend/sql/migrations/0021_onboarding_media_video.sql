-- Stricter publisher org identity + independent journalist onboarding fields.
-- Also expands media_assets for file uploads (image/video) owned by org or user,
-- and adds video_url on stories.

alter table organizations
  add column if not exists physical_address text,
  add column if not exists contact_person_name text,
  add column if not exists contact_person_title text,
  add column if not exists contact_person_email text,
  add column if not exists contact_person_phone text,
  add column if not exists contact_person_whatsapp text;

-- National ID is stored as a one-way hash + last4 only (never full plaintext on the row).
alter table journalists
  add column if not exists national_id_hash text,
  add column if not exists national_id_last4 text,
  add column if not exists district_id bigint references districts(id),
  add column if not exists topic_slugs text[] not null default '{}',
  add column if not exists whatsapp_number text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists identity_status text not null default 'self_declared';

create unique index if not exists journalists_national_id_hash_uidx
  on journalists (national_id_hash)
  where national_id_hash is not null;

alter table articles
  add column if not exists video_url text;

-- File-backed media library (images + videos). organization_id may be null for
-- independent journalists; owner_user_id is always set for uploaded files.
alter table media_assets
  alter column organization_id drop not null;

alter table media_assets
  add column if not exists owner_user_id bigint references users(id) on delete set null,
  add column if not exists media_type text not null default 'image',
  add column if not exists public_id uuid not null default gen_random_uuid(),
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists original_filename text;

create unique index if not exists media_assets_public_id_uidx on media_assets (public_id);
create index if not exists media_assets_owner_user_idx on media_assets (owner_user_id);
create index if not exists media_assets_media_type_idx on media_assets (media_type);
