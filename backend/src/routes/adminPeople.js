const express = require('express');
const pool = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();
router.use(requireRole('super_admin', 'newsroom_admin'));

// GET /api/admin/people/journalists
// All journalist profiles, including independents (org_id null) and account-linked rows.
router.get('/journalists', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const { rows } = await pool.query(
      `select
         j.id, j.name, j.slug, j.beat, j.bio, j.location, j.website_url, j.image_url,
         j.verified, j.is_independent, j.organization_id, j.user_id,
         j.topic_slugs, j.whatsapp_number, j.contact_phone, j.contact_email,
         j.national_id_last4, j.identity_status, j.created_at, j.updated_at,
         u.email as user_email, u.display_name as user_display_name, u.status as user_status,
         u.created_at as user_created_at, u.last_login_at,
         o.name as organization_name, o.verification_status as org_verification_status,
         (select count(*)::int from articles a
           where a.journalist_id = j.id and a.status = 'published' and a.hidden = false) as published_story_count,
         (select count(*)::int from articles a
           where a.created_by_user_id = j.user_id and a.organization_id is null) as independent_story_count
       from journalists j
       left join users u on u.id = j.user_id
       left join organizations o on o.id = j.organization_id
       where ($1 = '' or concat_ws(' ', j.name, j.slug, j.beat, u.email, u.display_name) ilike '%' || $1 || '%')
       order by
         (j.user_id is not null) desc,
         j.updated_at desc nulls last,
         j.created_at desc nulls last,
         j.name asc
       limit 200`,
      [q],
    );
    res.json({
      items: rows.map((j) => ({
        ...j,
        profile_url: `/journalists/profile.html?slug=${encodeURIComponent(j.slug)}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/people/users
// All dashboard accounts with roles (so you can see people who registered but never finished journalist onboarding).
router.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const { rows } = await pool.query(
      `select
         u.id, u.email, u.display_name, u.status, u.created_at, u.last_login_at,
         coalesce(
           (select json_agg(json_build_object('key', r.key, 'organizationId', ur.organization_id) order by r.key)
            from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id),
           '[]'::json
         ) as roles,
         j.id as journalist_id, j.name as journalist_name, j.slug as journalist_slug, j.is_independent
       from users u
       left join journalists j on j.user_id = u.id
       where ($1 = '' or concat_ws(' ', u.email, u.display_name, j.name) ilike '%' || $1 || '%')
       order by u.created_at desc
       limit 200`,
      [q],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/people/summary — command-center KPIs
router.get('/summary', async (req, res, next) => {
  try {
    const [
      users,
      independents,
      withAccounts,
      apps,
      pendingStories,
      publishedToday,
      publishedTotal,
      orgsUnverified,
      orgsApproved,
      recentUsers,
      recentJournalists,
      recentPending,
    ] = await Promise.all([
      pool.query('select count(*)::int as c from users'),
      pool.query(`select count(*)::int as c from journalists where is_independent = true and user_id is not null`),
      pool.query(`select count(*)::int as c from journalists where user_id is not null`),
      pool.query(`select count(*)::int as c from publisher_applications where stage not in ('approved','rejected')`),
      pool.query(`select count(*)::int as c from articles where status in ('pending_review','draft') and origin = 'publisher_authored'`),
      pool.query(`select count(*)::int as c from articles where status = 'published' and published_at::date = current_date`),
      pool.query(`select count(*)::int as c from articles where status = 'published' and hidden = false`),
      pool.query(`select count(*)::int as c from organizations where verification_status not in ('approved') and is_official = false`),
      pool.query(`select count(*)::int as c from organizations where verification_status = 'approved' or is_official = true`),
      pool.query(`
        select u.id, u.email, u.display_name, u.created_at, u.last_login_at,
               coalesce(array_agg(distinct r.key) filter (where r.key is not null), '{}') as roles
        from users u
        left join user_roles ur on ur.user_id = u.id
        left join roles r on r.id = ur.role_id
        group by u.id
        order by u.created_at desc
        limit 8
      `),
      pool.query(`
        select j.id, j.name, j.slug, j.is_independent, j.user_id, u.email, j.created_at
        from journalists j
        left join users u on u.id = j.user_id
        where j.user_id is not null
        order by j.created_at desc
        limit 8
      `),
      pool.query(`
        select a.id, a.title, a.status, a.organization_id, a.created_by_user_id, a.updated_at,
               u.email as author_email, u.display_name as author_name,
               o.name as org_name, o.verification_status
        from articles a
        left join users u on u.id = a.created_by_user_id
        left join organizations o on o.id = a.organization_id
        where a.status in ('pending_review', 'draft') and a.origin = 'publisher_authored'
        order by a.updated_at desc
        limit 12
      `),
    ]);
    res.json({
      users: users.rows[0].c,
      independentJournalists: independents.rows[0].c,
      journalistsWithAccounts: withAccounts.rows[0].c,
      openPublisherApplications: apps.rows[0].c,
      pendingReviewStories: pendingStories.rows[0].c,
      publishedToday: publishedToday.rows[0].c,
      publishedTotal: publishedTotal.rows[0].c,
      orgsUnverified: orgsUnverified.rows[0].c,
      orgsApproved: orgsApproved.rows[0].c,
      recentUsers: recentUsers.rows,
      recentJournalists: recentJournalists.rows,
      recentPendingStories: recentPending.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/people/stories?status=pending_review|draft|published
router.get('/stories', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const params = [];
    let where = `a.origin = 'publisher_authored'`;
    if (status) {
      params.push(status);
      where += ` and a.status = $${params.length}`;
    }
    const { rows } = await pool.query(
      `select a.id, a.title, a.status, a.organization_id, a.journalist_id, a.created_by_user_id,
              a.created_at, a.updated_at, a.published_at, a.summary,
              u.email as author_email, u.display_name as author_name,
              j.name as journalist_name, j.is_independent,
              o.name as org_name, o.verification_status, o.slug as org_slug
       from articles a
       left join users u on u.id = a.created_by_user_id
       left join journalists j on j.id = a.journalist_id
       left join organizations o on o.id = a.organization_id
       where ${where}
       order by a.updated_at desc
       limit 150`,
      params,
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/people/stories/:id/publish — force-publish (bypasses unapproved-org gate)
router.post('/stories/:id/publish', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: before } = await pool.query(
      'select id, title, status, organization_id, created_by_user_id, journalist_id from articles where id = $1',
      [id],
    );
    if (!before.length) return res.status(404).json({ error: 'Story not found.' });

    // Keep org byline when the outlet may publish (verified OR active website).
    // Only strip org linkage when the outlet cannot publish under current rules.
    if (before[0].organization_id) {
      const { canOrgPublish } = require('../storiesCore');
      const allowed = await canOrgPublish(before[0].organization_id);
      if (!allowed) {
        let journalistId = before[0].journalist_id;
        if (!journalistId && before[0].created_by_user_id) {
          const { rows: j } = await pool.query(
            'select id from journalists where user_id = $1',
            [before[0].created_by_user_id],
          );
          journalistId = j[0]?.id || null;
        }
        await pool.query(
          `update articles set organization_id = null, journalist_id = coalesce(journalist_id, $2), updated_at = now()
           where id = $1`,
          [id, journalistId],
        );
      }
    }

    const { rows } = await pool.query(
      `update articles set
         status = 'published',
         published_at = coalesce(published_at, now()),
         approved_at = coalesce(approved_at, now()),
         approved_by_user_id = coalesce(approved_by_user_id, $2),
         withdrawn_at = null,
         withdrawn_reason = null,
         updated_at = now()
       where id = $1
       returning id, title, status, organization_id, journalist_id, published_at`,
      [id, req.user.id],
    );
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/people/stories/:id — permanent delete (admin only)
// Query/body: ?soft=1 or { soft: true } to hide/archive instead of hard delete.
router.delete('/stories/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid story id.' });
    }

    const soft = req.query.soft === '1'
      || req.query.soft === 'true'
      || req.body?.soft === true
      || req.body?.soft === 'true';

    const { rows: existing } = await client.query(
      `select id, title, status, slug, organization_id, origin, published_at
       from articles where id = $1`,
      [id],
    );
    if (!existing.length) return res.status(404).json({ error: 'Story not found.' });
    const article = existing[0];

    if (soft) {
      const { rows } = await client.query(
        `update articles set
           hidden = true,
           status = 'archived',
           updated_at = now()
         where id = $1
         returning id, title, status, hidden`,
        [id],
      );
      return res.json({
        ok: true,
        mode: 'soft',
        item: rows[0],
        message: 'Story archived and hidden from public feeds.',
      });
    }

    await client.query('begin');
    // Detach FKs that do not cascade
    await client.query('update generation_jobs set article_id = null where article_id = $1', [id]);
    // article_corrections cascades; delete article
    const { rowCount } = await client.query('delete from articles where id = $1', [id]);
    await client.query('commit');

    if (!rowCount) return res.status(404).json({ error: 'Story not found.' });

    res.json({
      ok: true,
      mode: 'hard',
      deleted: {
        id: article.id,
        title: article.title,
        status: article.status,
        slug: article.slug,
      },
      message: 'Story permanently deleted.',
    });
  } catch (err) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/admin/people/journalists/:id/verify
router.post('/journalists/:id/verify', async (req, res, next) => {
  try {
    const verified = req.body.verified !== false;
    const { rows } = await pool.query(
      `update journalists set verified = $2, updated_at = now() where id = $1
       returning id, name, slug, verified, is_independent, user_id`,
      [req.params.id, verified],
    );
    if (!rows.length) return res.status(404).json({ error: 'Journalist not found.' });
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
