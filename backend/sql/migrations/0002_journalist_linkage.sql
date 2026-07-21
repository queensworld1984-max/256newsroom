alter table journalists add column if not exists user_id bigint references users(id);
alter table journalists add column if not exists organization_id bigint references organizations(id);
alter table journalists add column if not exists is_independent boolean not null default false;

create unique index if not exists journalists_user_id_idx on journalists(user_id) where user_id is not null;
create index if not exists journalists_organization_idx on journalists(organization_id);
