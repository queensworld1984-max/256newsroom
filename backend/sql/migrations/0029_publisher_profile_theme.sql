-- Publisher-chosen color theme for the public profile page.
-- Values: gold | mono | crimson | forest | slate
alter table organizations
  add column if not exists profile_theme text not null default 'gold';

comment on column organizations.profile_theme is
  'Public profile color theme: gold, mono, crimson, forest, slate';
