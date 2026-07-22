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

// GET /api/admin/people/summary
router.get('/summary', async (req, res, next) => {
  try {
    const [users, independents, withAccounts, apps, pendingStories] = await Promise.all([
      pool.query('select count(*)::int as c from users'),
      pool.query(`select count(*)::int as c from journalists where is_independent = true and user_id is not null`),
      pool.query(`select count(*)::int as c from journalists where user_id is not null`),
      pool.query(`select count(*)::int as c from publisher_applications where stage not in ('approved','rejected')`),
      pool.query(`select count(*)::int as c from articles where status = 'pending_review' and origin = 'publisher_authored'`),
    ]);
    res.json({
      users: users.rows[0].c,
      independentJournalists: independents.rows[0].c,
      journalistsWithAccounts: withAccounts.rows[0].c,
      openPublisherApplications: apps.rows[0].c,
      pendingReviewStories: pendingStories.rows[0].c,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
