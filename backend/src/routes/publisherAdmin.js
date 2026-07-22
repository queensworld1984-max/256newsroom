const express = require('express');
const pool = require('../db');
const { requireAuth, requireOrgAccess } = require('../auth');

const router = express.Router();

router.use('/:orgId(\\d+)', requireAuth, requireOrgAccess('orgId'));

router.get('/:orgId(\\d+)', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from organizations where id = $1', [req.params.orgId]);
    if (!rows.length) return res.status(404).json({ error: 'Organization not found.' });
    const org = rows[0];
    const cooldownDays = NAME_CHANGE_COOLDOWN_DAYS;
    let canChangeName = true;
    let nextNameChangeAt = null;
    if (org.name_changed_at) {
      const next = new Date(org.name_changed_at);
      next.setDate(next.getDate() + cooldownDays);
      canChangeName = next <= new Date();
      nextNameChangeAt = next.toISOString();
    }
    res.json({
      organization: org,
      publicUrl: org.short_path
        ? `https://256newsroom.com/${org.short_path}`
        : `https://256newsroom.com/publisher/${org.slug}`,
      nameChange: {
        cooldownDays,
        lastChangedAt: org.name_changed_at,
        canChangeNow: canChangeName,
        nextAllowedAt: canChangeName ? null : nextNameChangeAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

const NAME_CHANGE_COOLDOWN_DAYS = 30;

// Reserved top-level paths that cannot be claimed as publisher vanity URLs.
const RESERVED_SHORT_PATHS = new Set([
  'api', 'admin', 'dashboard', 'news', 'latest', 'districts', 'district', 'publisher',
  'publishers', 'media', 'rss', 'journalists', 'people', 'assets', 'static', 'login',
  'logout', 'search', 'sitemap.xml', 'robots.txt', 'engagement', 'health', 'auth',
  'me', 'platforms', 'categories', 'section', 'sections', 'about', 'help', 'support',
  'home', 'index', 'favicon.ico',
]);

function normalizeShortPath(raw) {
  let path = String(raw || '').trim().toLowerCase();
  path = path.replace(/^https?:\/\/(www\.)?256newsroom\.com\/?/i, '');
  path = path.replace(/^\//, '').split(/[?#]/)[0];
  path = path.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return path;
}

function shortPathError(path) {
  if (!path) return null; // clearing allowed
  if (path.length < 2) return 'Desired URL must be at least 2 characters.';
  if (path.length > 40) return 'Desired URL is too long (max 40 characters).';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) {
    return 'URL may only use lowercase letters, numbers, and hyphens (e.g. vox or my-news).';
  }
  if (RESERVED_SHORT_PATHS.has(path)) {
    return `“/${path}” is reserved by 256 Newsroom. Choose another path.`;
  }
  return null;
}

router.patch('/:orgId(\\d+)', async (req, res, next) => {
  try {
    const fields = req.body;
    const orgId = req.params.orgId;
    const { rows: currentRows } = await pool.query('select * from organizations where id = $1', [orgId]);
    if (!currentRows.length) return res.status(404).json({ error: 'Organization not found.' });
    const current = currentRows[0];

    const sets = [];
    const values = [];
    let i = 1;
    const allowed = {
      description: 'description',
      biography: 'biography',
      logoUrl: 'logo_url',
      websiteUrl: 'website_url',
      editorialContactEmail: 'editorial_contact_email',
      editorialContactPhone: 'editorial_contact_phone',
      socialLinks: 'social_links',
      tagline: 'tagline',
      headquarters: 'headquarters',
      yearsInJournalism: 'years_in_journalism',
      foundedYear: 'founded_year',
      areasOfPractice: 'areas_of_practice',
      profileTheme: 'profile_theme',
    };
    const PROFILE_THEMES = new Set(['gold', 'mono', 'crimson', 'forest', 'slate']);
    for (const [key, column] of Object.entries(allowed)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = $${i}`);
        let val = fields[key];
        if (key === 'socialLinks') val = JSON.stringify(val);
        if (key === 'areasOfPractice') {
          val = Array.isArray(val)
            ? val.map((x) => String(x).trim()).filter(Boolean)
            : String(val || '').split(',').map((x) => x.trim()).filter(Boolean);
        }
        if (key === 'yearsInJournalism' || key === 'foundedYear') {
          val = val === '' || val == null ? null : Number(val);
        }
        if (key === 'profileTheme') {
          val = String(val || 'gold').toLowerCase().trim();
          if (!PROFILE_THEMES.has(val)) {
            return res.status(400).json({
              error: 'Invalid profile theme. Choose gold, mono, crimson, forest, or slate.',
            });
          }
        }
        values.push(val);
        i += 1;
      }
    }

    // Display name — at most once every 30 days (first correction always allowed).
    // Global admins may always force a rename. If cooldown blocks rename, other fields still save.
    let nameChangeBlocked = null;
    if (fields.name !== undefined) {
      const newName = String(fields.name || '').trim().slice(0, 200);
      if (!newName) {
        // Ignore empty name rather than failing the whole profile save.
      } else if (newName !== current.name) {
        const isGlobalAdmin = (req.user?.roles || []).some((r) =>
          ['super_admin', 'newsroom_admin'].includes(r.key));
        if (current.name_changed_at && !isGlobalAdmin) {
          const nextAllowed = new Date(current.name_changed_at);
          nextAllowed.setDate(nextAllowed.getDate() + NAME_CHANGE_COOLDOWN_DAYS);
          if (nextAllowed > new Date()) {
            nameChangeBlocked = {
              error: `Other profile fields were saved, but the name can only be changed once every ${NAME_CHANGE_COOLDOWN_DAYS} days. Next rename after ${nextAllowed.toISOString().slice(0, 10)}.`,
              nextAllowedAt: nextAllowed.toISOString(),
              cooldownDays: NAME_CHANGE_COOLDOWN_DAYS,
            };
          }
        }
        if (!nameChangeBlocked) {
          sets.push(`name = $${i}`);
          values.push(newName);
          i += 1;
          sets.push('name_changed_at = now()');
        }
      }
    }

    // Desired vanity URL: 256newsroom.com/{short_path}
    if (fields.shortPath !== undefined || fields.desiredUrl !== undefined) {
      const raw = fields.shortPath !== undefined ? fields.shortPath : fields.desiredUrl;
      const path = raw === null || raw === '' ? null : normalizeShortPath(raw);
      const err = shortPathError(path);
      if (err) return res.status(400).json({ error: err });
      if (path && path !== current.short_path) {
        const { rows: taken } = await pool.query(
          `select id, name from organizations
           where lower(short_path) = $1 and id <> $2`,
          [path, orgId],
        );
        if (taken.length) {
          return res.status(409).json({ error: `“/${path}” is already taken by another publisher.` });
        }
        // Also avoid colliding with category slugs
        const { rows: cats } = await pool.query(
          'select 1 from categories where lower(slug) = $1 limit 1',
          [path],
        );
        if (cats.length) {
          return res.status(409).json({ error: `“/${path}” is already used as a news section.` });
        }
        sets.push(`short_path = $${i}`);
        values.push(path);
        i += 1;
        sets.push('short_path_changed_at = now()');
      } else if (path === null && current.short_path) {
        sets.push('short_path = null');
        sets.push('short_path_changed_at = now()');
      }
    }

    if (!sets.length) {
      if (nameChangeBlocked) {
        return res.status(429).json(nameChangeBlocked);
      }
      // Idempotent save: return current org so the UI still treats this as success.
      return res.json({
        organization: current,
        publicUrl: current.short_path
          ? `https://256newsroom.com/${current.short_path}`
          : `https://256newsroom.com/publisher/${current.slug}`,
        ok: true,
        unchanged: true,
      });
    }
    sets.push('updated_at = now()');
    values.push(orgId);
    const { rows } = await pool.query(
      `update organizations set ${sets.join(', ')} where id = $${i} returning *`,
      values,
    );
    const org = rows[0];
    res.json({
      organization: org,
      ok: true,
      warning: nameChangeBlocked ? nameChangeBlocked.error : null,
      publicUrl: org.short_path
        ? `https://256newsroom.com/${org.short_path}`
        : `https://256newsroom.com/publisher/${org.slug}`,
      nameChange: {
        cooldownDays: NAME_CHANGE_COOLDOWN_DAYS,
        lastChangedAt: org.name_changed_at,
        canChangeNow: !org.name_changed_at || (
          Date.now() - new Date(org.name_changed_at).getTime()
          >= NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
        ),
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That short URL is already taken.' });
    }
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

// LinkedIn-style work / experience entries on the publisher profile
router.get('/:orgId(\\d+)/work-profiles', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select * from publisher_work_profiles
       where organization_id = $1
       order by is_current desc, sort_order asc, start_year desc nulls last, id desc`,
      [req.params.orgId],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/work-profiles', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 200);
    const organizationName = String(req.body.organizationName || req.body.organization_name || '').trim().slice(0, 200);
    if (!title || !organizationName) {
      return res.status(400).json({ error: 'Title and organization name are required.' });
    }
    const { rows } = await pool.query(
      `insert into publisher_work_profiles
        (organization_id, title, organization_name, location, start_year, end_year, is_current, description, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        req.params.orgId,
        title,
        organizationName,
        req.body.location ? String(req.body.location).slice(0, 200) : null,
        req.body.startYear != null && req.body.startYear !== '' ? Number(req.body.startYear) : null,
        req.body.endYear != null && req.body.endYear !== '' ? Number(req.body.endYear) : null,
        Boolean(req.body.isCurrent),
        req.body.description ? String(req.body.description).slice(0, 4000) : null,
        req.body.sortOrder != null ? Number(req.body.sortOrder) : 0,
      ],
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId(\\d+)/work-profiles/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'delete from publisher_work_profiles where id = $1 and organization_id = $2',
      [req.params.id, req.params.orgId],
    );
    if (!rowCount) return res.status(404).json({ error: 'Work profile not found.' });
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
