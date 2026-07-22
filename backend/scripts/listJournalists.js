const pool = require('../src/db');
(async () => {
  const j = await pool.query(`
    select j.id, j.name, j.slug, j.user_id, j.is_independent, j.verified, j.organization_id,
           j.created_at, u.email, u.display_name, u.created_at as user_created, u.status as user_status
    from journalists j
    left join users u on u.id = j.user_id
    order by coalesce(j.created_at, u.created_at) desc nulls last
    limit 50
  `);
  console.log('=== journalists table ===');
  for (const r of j.rows) {
    console.log(`#${r.id} ${r.name} slug=${r.slug} user=${r.email || '-'} indep=${r.is_independent} org=${r.organization_id} verified=${r.verified}`);
  }

  const u = await pool.query(`
    select u.id, u.email, u.display_name, u.created_at, u.status,
           coalesce(array_agg(distinct r.key) filter (where r.key is not null), '{}') as roles
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id
    group by u.id
    order by u.created_at desc
    limit 30
  `);
  console.log('\n=== users ===');
  for (const r of u.rows) {
    console.log(`#${r.id} ${r.email} | ${r.display_name || '-'} | ${r.roles.join(',')} | ${r.created_at}`);
  }

  const apps = await pool.query(`
    select pa.id, pa.stage, o.name, o.verification_status, u.email, pa.submitted_at
    from publisher_applications pa
    join organizations o on o.id = pa.organization_id
    left join users u on u.id = pa.applicant_user_id
    order by pa.submitted_at desc limit 20
  `);
  console.log('\n=== publisher applications ===');
  for (const r of apps.rows) {
    console.log(`#${r.id} ${r.name} stage=${r.stage} ver=${r.verification_status} by ${r.email}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
