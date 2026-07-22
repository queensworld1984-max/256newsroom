const express = require('express');
const pool = require('../db');
const { requireAuth, requireOrgAccess } = require('../auth');

const router = express.Router();

router.use('/:orgId(\\d+)', requireAuth, requireOrgAccess('orgId'));

router.get('/:orgId(\\d+)', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from organizations where id = $1', [req.params.orgId]);
    if (!rows.length) return res.status(404).json({ error: 'Organization not found.' });
    res.json({ organization: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/:orgId(\\d+)', async (req, res, next) => {
  try {
    const fields = req.body;
    const sets = [];
    const values = [];
    let i = 1;
    const allowed = {
      description: 'description', logoUrl: 'logo_url', websiteUrl: 'website_url',
      editorialContactEmail: 'editorial_contact_email', editorialContactPhone: 'editorial_contact_phone',
      socialLinks: 'social_links',
    };
    for (const [key, column] of Object.entries(allowed)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = $${i}`);
        values.push(key === 'socialLinks' ? JSON.stringify(fields[key]) : fields[key]);
        i += 1;
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided.' });
    sets.push('updated_at = now()');
    values.push(req.params.orgId);
    const { rows } = await pool.query(`update organizations set ${sets.join(', ')} where id = $${i} returning *`, values);
    res.json({ organization: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId(\\d+)/members', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select u.id, u.email, u.display_name, u.status, r.key as role
       from user_roles ur
       join users u on u.id = ur.user_id
       join roles r on r.id = ur.role_id
       where ur.organization_id = $1
       order by u.display_name nulls last, u.email`,
      [req.params.orgId],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

const ORG_SCOPED_ROLES = new Set(['publisher_owner', 'publisher_editor', 'journalist']);

router.post('/:orgId(\\d+)/members/invite', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const roleKey = String(req.body.role || 'publisher_editor');
    if (!ORG_SCOPED_ROLES.has(roleKey)) return res.status(400).json({ error: `Role must be one of: ${[...ORG_SCOPED_ROLES].join(', ')}` });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email address is required.' });

    let { rows: userRows } = await pool.query('select id from users where email = $1', [email]);
    let userId = userRows[0]?.id;
    if (!userId) {
      const { rows: created } = await pool.query(
        `insert into users (email, status) values ($1, 'pending_invite') returning id`,
        [email],
      );
      userId = created[0].id;
    }

    const { rows: roleRows } = await pool.query('select id from roles where key = $1', [roleKey]);
    await pool.query(
      'insert into user_roles (user_id, role_id, organization_id) values ($1, $2, $3) on conflict do nothing',
      [userId, roleRows[0].id, req.params.orgId],
    );
    res.status(201).json({ ok: true, userId, role: roleKey });
  } catch (err) {
    next(err);
  }
});

router.patch('/:orgId(\\d+)/members/:userId', async (req, res, next) => {
  try {
    const roleKey = String(req.body.role || '');
    if (!ORG_SCOPED_ROLES.has(roleKey)) return res.status(400).json({ error: `Role must be one of: ${[...ORG_SCOPED_ROLES].join(', ')}` });
    const { rows: roleRows } = await pool.query('select id from roles where key = $1', [roleKey]);
    await pool.query('delete from user_roles where user_id = $1 and organization_id = $2', [req.params.userId, req.params.orgId]);
    await pool.query(
      'insert into user_roles (user_id, role_id, organization_id) values ($1, $2, $3)',
      [req.params.userId, roleRows[0].id, req.params.orgId],
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId(\\d+)/journalists', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from journalists where organization_id = $1 order by name', [req.params.orgId]);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/journalists', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const slug = String(req.body.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
    const userId = req.body.userId || null;
    const { rows } = await pool.query(
      `insert into journalists (name, slug, beat, organization_id, user_id, is_independent)
       values ($1, $2, $3, $4, $5, false)
       on conflict (slug) do update set name = excluded.name, beat = excluded.beat, organization_id = excluded.organization_id
       returning *`,
      [name, slug, req.body.beat || null, req.params.orgId, userId],
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/:orgId(\\d+)/journalists/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `update journalists set
         name = coalesce($3, name),
         beat = coalesce($4, beat),
         updated_at = now()
       where id = $1 and organization_id = $2
       returning *`,
      [req.params.id, req.params.orgId, req.body.name || null, req.body.beat || null],
    );
    if (!rows.length) return res.status(404).json({ error: 'Journalist not found in this organization.' });
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId(\\d+)/media', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select * from media_assets where organization_id = $1 order by created_at desc limit 200',
      [req.params.orgId],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/media', async (req, res, next) => {
  try {
    const url = String(req.body.url || '').trim().slice(0, 1000);
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'A valid http(s) image URL is required.' });
    const { rows } = await pool.query(
      `insert into media_assets (organization_id, url, caption, credit, alt_text, added_by_user_id)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        req.params.orgId, url,
        req.body.caption ? String(req.body.caption).slice(0, 300) : null,
        req.body.credit ? String(req.body.credit).slice(0, 200) : null,
        req.body.altText ? String(req.body.altText).slice(0, 300) : null,
        req.user.id,
      ],
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId(\\d+)/media/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'delete from media_assets where id = $1 and organization_id = $2',
      [req.params.id, req.params.orgId],
    );
    if (!rowCount) return res.status(404).json({ error: 'Media asset not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId(\\d+)/corrections', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select ac.*, a.title as current_title, a.slug
       from article_corrections ac
       join articles a on a.id = ac.article_id
       where a.organization_id = $1
       order by ac.corrected_at desc
       limit 200`,
      [req.params.orgId],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

// Real counts derived from the organization's own articles — no fabricated
// engagement/reach figures (see backend/sql/migrations/0008_*).
router.get('/:orgId(\\d+)/analytics', async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const [statusCounts, categoryCounts, publishTrend, totals] = await Promise.all([
      pool.query(
        `select status, count(*)::int as count from articles where organization_id = $1 group by status`,
        [orgId],
      ),
      pool.query(
        `select c.name, c.slug, count(a.id)::int as count
         from articles a join categories c on c.id = a.category_id
         where a.organization_id = $1 group by c.id order by count desc`,
        [orgId],
      ),
      pool.query(
        `select date_trunc('day', published_at)::date as day, count(*)::int as count
         from articles
         where organization_id = $1 and status = 'published' and published_at > now() - interval '30 days'
         group by day order by day`,
        [orgId],
      ),
      pool.query(
        `select
           count(*) filter (where status = 'published')::int as published_count,
           count(*) filter (where breaking)::int as breaking_count,
           count(*) filter (where developing)::int as developing_count,
           min(published_at) as first_published_at,
           max(published_at) as most_recent_published_at
         from articles where organization_id = $1`,
        [orgId],
      ),
    ]);
    res.json({
      byStatus: statusCounts.rows,
      byCategory: categoryCounts.rows,
      publishTrend: publishTrend.rows,
      totals: totals.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
