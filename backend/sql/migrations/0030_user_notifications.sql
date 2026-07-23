-- In-app notifications for publishers / journalists (website verified, application stages, etc.)

create table if not exists user_notifications (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  organization_id bigint references organizations(id) on delete set null,
  meta jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on user_notifications (user_id, created_at desc);

create index if not exists user_notifications_user_unread_idx
  on user_notifications (user_id)
  where read_at is null;
