-- Publisher personalization: profile image (logo_url already exists),
-- name change cooldown, and desired short URL path (e.g. 256newsroom.com/vox).

alter table organizations
  add column if not exists name_changed_at timestamptz,
  add column if not exists short_path text,
  add column if not exists short_path_changed_at timestamptz;

-- Unique short vanity path when set (lowercase path segment only).
create unique index if not exists organizations_short_path_uidx
  on organizations (lower(short_path))
  where short_path is not null and short_path <> '';

comment on column organizations.short_path is 'Public vanity path, e.g. vox → https://256newsroom.com/vox';
comment on column organizations.name_changed_at is 'Last time display name was changed (30-day cooldown).';
