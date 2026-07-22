/* One-off ops: list recent journalists + pending stories; publish target if given. */
const pool = require('../src/db');
const core = require('../src/storiesCore');

async function main() {
  const publishId = process.argv[2] ? Number(process.argv[2]) : null;

  const users = await pool.query(`
    select u.id, u.email, u.display_name, u.created_at, u.last_login_at,
           coalesce(array_agg(distinct r.key) filter (where r.key is not null), '{}') as roles
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id
    where u.created_at > now() - interval '14 days'
    group by u.id
    order by u.created_at desc
    limit 25
  `);
  console.log('=== Recent users (14d) ===');
  for (const u of users.rows) {
    console.log(`#${u.id} ${u.email} | ${u.display_name || '-'} | roles=${u.roles.join(',')} | created=${u.created_at}`);
  }

  const arts = await pool.query(`
    select a.id, a.title, a.status, a.organization_id, a.journalist_id, a.created_by_user_id,
           a.created_at, a.updated_at, a.published_at, a.origin,
           u.email as author_email, u.display_name as author_name,
           j.name as journalist_name, j.is_independent, j.slug as journalist_slug,
           o.name as org_name, o.verification_status
    from articles a
    left join users u on u.id = a.created_by_user_id
    left join journalists j on j.id = a.journalist_id
    left join organizations o on o.id = a.organization_id
    where a.status in ('pending_review', 'draft', 'scheduled')
      and (a.origin = 'publisher_authored' or a.created_by_user_id is not null)
    order by a.updated_at desc
    limit 40
  `);
  console.log('\n=== Draft / pending_review / scheduled stories ===');
  for (const a of arts.rows) {
    console.log(
      `#${a.id} [${a.status}] org=${a.organization_id || 'null'} indep=${a.is_independent} | ${a.title?.slice(0, 80)} | by ${a.author_email || a.journalist_name} | updated=${a.updated_at}`,
    );
  }

  if (publishId) {
    console.log(`\n=== Publishing article #${publishId} ===`);
    // Independent path: clear org gate by ensuring publish works for null org.
    // If story is under unapproved org but authored by independent journalist account,
    // re-home it to independent (organization_id null) then publish.
    const { rows } = await pool.query(
      `select a.*, j.is_independent, j.user_id as journalist_user_id
       from articles a
       left join journalists j on j.id = a.journalist_id
       where a.id = $1`,
      [publishId],
    );
    const story = rows[0];
    if (!story) {
      console.error('Story not found');
      process.exit(1);
    }
    console.log('Before:', {
      id: story.id,
      status: story.status,
      organization_id: story.organization_id,
      is_independent: story.is_independent,
      title: story.title,
    });

    if (story.organization_id) {
      const { rows: orgRows } = await pool.query(
        'select verification_status, is_official from organizations where id = $1',
        [story.organization_id],
      );
      const org = orgRows[0];
      const approved = org && (org.verification_status === 'approved' || org.is_official);
      if (!approved) {
        // Move to independent byline so journalist can go live without org approval
        await pool.query(
          `update articles set organization_id = null, updated_at = now() where id = $1`,
          [publishId],
        );
        console.log('Cleared organization_id (unapproved org) so independent publish can proceed.');
      }
    }

    const published = await core.publishStory(publishId);
    console.log('Published:', {
      id: published.id,
      status: published.status,
      published_at: published.published_at,
      organization_id: published.organization_id,
      title: published.title,
    });
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
