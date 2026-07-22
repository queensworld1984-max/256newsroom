create table if not exists publisher_applications (
  id bigserial primary key,
  organization_id bigint not null unique references organizations(id) on delete cascade,
  applicant_user_id bigint references users(id),
  stage text not null default 'application',
  business_details jsonb not null default '{}',
  identity_documents jsonb not null default '[]',
  website_verification_method text,
  website_verification_token text,
  website_verified_at timestamptz,
  reviewed_by_user_id bigint references users(id),
  review_notes text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists application_stage_events (
  id bigserial primary key,
  application_id bigint not null references publisher_applications(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  actor_user_id bigint references users(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists application_stage_events_application_idx on application_stage_events(application_id);
