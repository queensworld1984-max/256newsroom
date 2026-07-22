/**
 * Ops: publish a journalist's pending article and enable independent auto-publish.
 * Usage: node scripts/publishJournalistArticle.js <articleId>
 */
const pool = require('../src/db');

async function main() {
  const id = Number(process.argv[2]);
  if (!id) {
    console.error('Usage: node scripts/publishJournalistArticle.js <articleId>');
    process.exit(1);
  }

  const { rows: beforeRows } = await pool.query(
    `select a.id, a.title, a.status, a.organization_id, a.journalist_id, a.published_at, a.created_by_user_id,
            u.email, u.display_name
     from articles a
     left join users u on u.id = a.created_by_user_id
     where a.id = $1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) {
    console.error('Article not found:', id);
    process.exit(1);
  }
  console.log('BEFORE', before);

  const userId = before.created_by_user_id;
  if (!userId) {
    console.error('Article has no created_by_user_id');
    process.exit(1);
  }

  // 1) Grant independent_journalist role
  const { rows: roleRows } = await pool.query("select id from roles where key = 'independent_journalist'");
  await pool.query(
    'insert into user_roles (user_id, role_id, organization_id) values ($1, $2, null) on conflict do nothing',
    [userId, roleRows[0].id],
  );

  // 2) Ensure journalist profile (independent)
  let { rows: jRows } = await pool.query(
    'select id, name, slug, is_independent from journalists where user_id = $1',
    [userId],
  );
  if (!jRows.length) {
    const name = before.display_name || before.email.split('@')[0];
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'journalist';
    let slug = baseSlug;
    let n = 1;
    for (;;) {
      const { rows: clash } = await pool.query('select 1 from journalists where slug = $1', [slug]);
      if (!clash.length) break;
      n += 1;
      slug = `${baseSlug}-${n}`;
    }
    const ins = await pool.query(
      `insert into journalists (name, slug, user_id, is_independent)
       values ($1, $2, $3, true) returning id, name, slug, is_independent`,
      [name, slug, userId],
    );
    jRows = ins.rows;
    console.log('Created journalist profile', jRows[0]);
  } else {
    await pool.query(
      'update journalists set is_independent = true, updated_at = now() where user_id = $1',
      [userId],
    );
    console.log('Marked journalist independent', jRows[0]);
  }
  const journalistId = jRows[0].id;

  // 3) Publish under independent byline (clear unapproved org so future edits are not gated)
  const { rows: afterRows } = await pool.query(
    `update articles set
       status = 'published',
       published_at = coalesce(published_at, now()),
       approved_at = coalesce(approved_at, now()),
       organization_id = null,
       journalist_id = coalesce(journalist_id, $2),
       withdrawn_at = null,
       withdrawn_reason = null,
       updated_at = now()
     where id = $1
     returning id, title, status, organization_id, journalist_id, published_at, created_by_user_id`,
    [id, journalistId],
  );
  console.log('PUBLISHED', afterRows[0]);

  const { rows: roles } = await pool.query(
    `select r.key from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = $1 order by r.key`,
    [userId],
  );
  console.log('USER_ROLES', roles.map((r) => r.key));
  console.log('OK');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
