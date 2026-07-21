create table if not exists organizations (
  id bigserial primary key,
  name text not null,
  slug text not null unique,
  org_type text not null default 'local_publisher',
  description text,
  logo_url text,
  website_url text,
  editorial_contact_email text,
  editorial_contact_phone text,
  social_links jsonb not null default '{}',
  parent_organization_id bigint references organizations(id),
  active boolean not null default true,
  verification_status text not null default 'unverified',
  verification_notes text,
  is_official boolean not null default false,
  protected_from_deletion boolean not null default false,
  excluded_from_verification_queue boolean not null default false,
  include_in_main_feed boolean not null default true,
  source_id bigint references sources(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_parent_idx on organizations(parent_organization_id);
create index if not exists organizations_verification_status_idx on organizations(verification_status);

create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  password_hash text,
  password_algo text not null default 'argon2id',
  email_verified_at timestamptz,
  display_name text,
  avatar_url text,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id bigserial primary key,
  key text not null unique,
  label text not null
);

insert into roles (key, label) values
  ('super_admin', 'Super Administrator'),
  ('newsroom_admin', 'Newsroom Administrator'),
  ('publisher_owner', 'Publisher Owner'),
  ('publisher_editor', 'Publisher Editor'),
  ('journalist', 'Journalist'),
  ('independent_journalist', 'Independent Journalist'),
  ('citizen_contributor', 'Citizen Contributor')
on conflict (key) do nothing;

create table if not exists user_roles (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  role_id bigint not null references roles(id) on delete cascade,
  organization_id bigint references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, organization_id)
);

create index if not exists user_roles_user_idx on user_roles(user_id);
create index if not exists user_roles_org_idx on user_roles(organization_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);

create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);
