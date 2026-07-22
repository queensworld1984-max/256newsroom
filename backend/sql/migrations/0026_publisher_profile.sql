-- Publisher likes + LinkedIn-style profile fields and work experience.

create table if not exists publisher_likes (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  organization_id bigint references organizations(id) on delete cascade,
  journalist_id bigint references journalists(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint publisher_likes_target_chk check (
    (organization_id is not null and journalist_id is null)
    or (organization_id is null and journalist_id is not null)
  )
);

create unique index if not exists publisher_likes_user_org_uidx
  on publisher_likes (user_id, organization_id)
  where organization_id is not null;

create unique index if not exists publisher_likes_user_journalist_uidx
  on publisher_likes (user_id, journalist_id)
  where journalist_id is not null;

create index if not exists publisher_likes_org_idx on publisher_likes (organization_id);
create index if not exists publisher_likes_journalist_idx on publisher_likes (journalist_id);

-- Organization public profile (LinkedIn-style)
alter table organizations
  add column if not exists biography text,
  add column if not exists areas_of_practice text[] not null default '{}',
  add column if not exists years_in_journalism integer,
  add column if not exists founded_year integer,
  add column if not exists headquarters text,
  add column if not exists tagline text;

-- Journalist public profile extras
alter table journalists
  add column if not exists areas_of_practice text[] not null default '{}',
  add column if not exists years_in_journalism integer,
  add column if not exists tagline text;

-- Work / career entries (like LinkedIn experience)
create table if not exists publisher_work_profiles (
  id bigserial primary key,
  organization_id bigint references organizations(id) on delete cascade,
  journalist_id bigint references journalists(id) on delete cascade,
  title text not null,
  organization_name text not null,
  location text,
  start_year integer,
  end_year integer,
  is_current boolean not null default false,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publisher_work_profiles_owner_chk check (
    (organization_id is not null and journalist_id is null)
    or (organization_id is null and journalist_id is not null)
  )
);

create index if not exists publisher_work_profiles_org_idx
  on publisher_work_profiles (organization_id, sort_order, start_year desc nulls last);

create index if not exists publisher_work_profiles_journalist_idx
  on publisher_work_profiles (journalist_id, sort_order, start_year desc nulls last);
