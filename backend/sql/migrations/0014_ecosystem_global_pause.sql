create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_user_id bigint references users(id)
);

insert into system_settings (key, value)
values ('ecosystem_automation_paused', 'false')
on conflict (key) do nothing;
