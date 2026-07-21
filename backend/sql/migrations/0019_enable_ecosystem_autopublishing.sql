-- User-authorized production rollout: publish verified platform coverage
-- automatically and broaden discovery beyond thin/unchanged homepages.
update automation_settings s
set mode = 'automatic', updated_at = now()
from organizations o
where s.organization_id = o.id and o.org_type = 'ecosystem_platform';

insert into approved_domains (organization_id, domain)
select id, '256express.com' from organizations where name = '256 Express'
on conflict (organization_id, domain) do update set active = true;

insert into platform_sources (organization_id, url, label, content_type_hint)
select id, 'https://256express.com/', 'Official 256 Express website', 'Platform Overview' from organizations where name = '256 Express'
union all
select id, 'https://256heart.com/safety', 'Safety information', 'Safety Notice' from organizations where name = '256 Heart'
union all
select id, 'https://256heart.com/plans', 'Membership plans', 'Pricing Update' from organizations where name = '256 Heart'
union all
select id, 'https://256.ug/wholesale', 'Wholesale marketplace', 'Service Spotlight' from organizations where name = '256 Mall'
union all
select id, 'https://256.ug/export', 'Export marketplace', 'Service Spotlight' from organizations where name = '256 Mall'
on conflict (organization_id, url) do update set active = true, label = excluded.label, content_type_hint = excluded.content_type_hint;

