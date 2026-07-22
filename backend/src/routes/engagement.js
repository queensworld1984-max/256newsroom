const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Only registered 256 Newsroom journalists / publishers / admins may engage.
const CONTRIBUTOR_ROLES = [
  'independent_journalist',
  'publisher_owner',
  'publisher_editor',
  'journalist',
  'super_admin',
  'newsroom_admin',
];

const requireContributor = [requireAuth, requireRole(...CONTRIBUTOR_ROLES)];

function isContributor(user) {
  if (!user?.roles?.length) return false;
  const allowed = new Set(CONTRIBUTOR_ROLES);
  return user.roles.some((r) => allowed.has(r.key));
}

async function articleEngagementSummary(articleId, userId = null) {
  const [likes, upvotes, comments, mine] = await Promise.all([
    pool.query('select count(*)::int as c from article_likes where article_id = $1', [articleId]),
    pool.query('select count(*)::int as c from article_upvotes where article_id = $1', [articleId]),
    pool.query('select count(*)::int as c from article_comments where article_id = $1 and hidden = false', [articleId]),
    userId
      ? pool.query(
        `select
           exists(select 1 from article_likes where article_id = $1 and user_id = $2) as liked,
           exists(select 1 from article_upvotes where article_id = $1 and user_id = $2) as upvoted`,
        [articleId, userId],
      )
      : Promise.resolve({ rows: [{ liked: false, upvoted: false }] }),
  ]);
  return {
    likes: likes.rows[0].c,
    upvotes: upvotes.rows[0].c,
    comments: comments.rows[0].c,
    liked: Boolean(mine.rows[0]?.liked),
    upvoted: Boolean(mine.rows[0]?.upvoted),
  };
}

// GET /api/engagement/me — can this session engage?
router.get('/me', (req, res) => {
  const user = req.user || null;
  res.json({
    authenticated: Boolean(user),
    canEngage: isContributor(user),
    user: user
      ? { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles.map((r) => r.key) }
      : null,
    loginUrl: '/dashboard/login.html?next=' + encodeURIComponent(req.get('referer') || '/dashboard/'),
  });
});

// GET /api/engagement/articles/:id
router.get('/articles/:id', async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const { rows } = await pool.query(
      `select a.id, a.title, a.status, a.hidden, a.organization_id, a.journalist_id, a.slug, a.internal_url,
              o.name as org_name, o.slug as org_slug, o.logo_url as org_logo, o.verification_status, o.is_official,
              j.name as journalist_name, j.slug as journalist_slug, j.image_url as journalist_image, j.is_independent
       from articles a
       left join organizations o on o.id = a.organization_id
       left join journalists j on j.id = a.journalist_id
       where a.id = $1`,
      [articleId],
    );
    if (!rows.length || rows[0].hidden || rows[0].status !== 'published') {
      return res.status(404).json({ error: 'Article not found.' });
    }
    const a = rows[0];
    const summary = await articleEngagementSummary(articleId, req.user?.id || null);

    let following = false;
    if (req.user && isContributor(req.user)) {
      if (a.organization_id) {
        const { rows: f } = await pool.query(
          'select 1 from publisher_follows where user_id = $1 and organization_id = $2',
          [req.user.id, a.organization_id],
        );
        following = f.length > 0;
      } else if (a.journalist_id) {
        const { rows: f } = await pool.query(
          'select 1 from publisher_follows where user_id = $1 and journalist_id = $2',
          [req.user.id, a.journalist_id],
        );
        following = f.length > 0;
      }
    }

    const publisher = a.organization_id
      ? {
        type: 'organization',
        id: a.organization_id,
        name: a.org_name,
        slug: a.org_slug,
        logoUrl: a.org_logo,
        profileUrl: `/publisher/${a.org_slug}`,
        badge: a.is_official ? 'Official' : (a.verification_status === 'approved' ? 'Verified publisher' : 'Registered publisher'),
        followable: true,
      }
      : a.journalist_id
        ? {
          type: 'journalist',
          id: a.journalist_id,
          name: a.journalist_name,
          slug: a.journalist_slug,
          logoUrl: a.journalist_image,
          profileUrl: `/journalists/profile.html?slug=${encodeURIComponent(a.journalist_slug)}`,
          badge: a.is_independent ? 'Independent journalist' : 'Journalist',
          followable: true,
        }
        : {
          type: 'source',
          name: '256 Newsroom',
          profileUrl: '/',
          followable: false,
        };

    res.json({
      articleId,
      canEngage: isContributor(req.user),
      authenticated: Boolean(req.user),
      following,
      publisher,
      engagement: summary,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/engagement/articles/:id/like  — toggle like
router.post('/articles/:id/like', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const { rows: art } = await pool.query(
      `select id from articles where id = $1 and status = 'published' and hidden = false`,
      [articleId],
    );
    if (!art.length) return res.status(404).json({ error: 'Article not found.' });

    const { rows: existing } = await pool.query(
      'select id from article_likes where article_id = $1 and user_id = $2',
      [articleId, req.user.id],
    );
    if (existing.length) {
      await pool.query('delete from article_likes where id = $1', [existing[0].id]);
    } else {
      await pool.query(
        'insert into article_likes (article_id, user_id) values ($1, $2) on conflict do nothing',
        [articleId, req.user.id],
      );
    }
    const summary = await articleEngagementSummary(articleId, req.user.id);
    res.json({ ok: true, engagement: summary });
  } catch (err) {
    next(err);
  }
});

// POST /api/engagement/articles/:id/upvote — toggle upvote
router.post('/articles/:id/upvote', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const { rows: art } = await pool.query(
      `select id from articles where id = $1 and status = 'published' and hidden = false`,
      [articleId],
    );
    if (!art.length) return res.status(404).json({ error: 'Article not found.' });

    const { rows: existing } = await pool.query(
      'select id from article_upvotes where article_id = $1 and user_id = $2',
      [articleId, req.user.id],
    );
    if (existing.length) {
      await pool.query('delete from article_upvotes where id = $1', [existing[0].id]);
    } else {
      await pool.query(
        'insert into article_upvotes (article_id, user_id) values ($1, $2) on conflict do nothing',
        [articleId, req.user.id],
      );
    }
    const summary = await articleEngagementSummary(articleId, req.user.id);
    res.json({ ok: true, engagement: summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/engagement/articles/:id/comments
router.get('/articles/:id/comments', async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const { rows } = await pool.query(
      `select c.id, c.body, c.created_at, c.parent_id,
              u.id as user_id, u.display_name, u.email,
              j.name as journalist_name, j.slug as journalist_slug
       from article_comments c
       join users u on u.id = c.user_id
       left join journalists j on j.user_id = u.id
       where c.article_id = $1 and c.hidden = false
       order by c.created_at asc
       limit 200`,
      [articleId],
    );
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        parentId: r.parent_id,
        author: {
          id: r.user_id,
          name: r.journalist_name || r.display_name || r.email.split('@')[0],
          profileUrl: r.journalist_slug
            ? `/journalists/profile.html?slug=${encodeURIComponent(r.journalist_slug)}`
            : null,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/engagement/articles/:id/comments
router.post('/articles/:id/comments', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const body = String(req.body.body || req.body.comment || '').trim();
    if (body.length < 2) return res.status(400).json({ error: 'Comment is too short.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Comment is too long (max 2000 characters).' });

    const { rows: art } = await pool.query(
      `select id from articles where id = $1 and status = 'published' and hidden = false`,
      [articleId],
    );
    if (!art.length) return res.status(404).json({ error: 'Article not found.' });

    const parentId = req.body.parentId ? Number(req.body.parentId) : null;
    if (parentId) {
      const { rows: p } = await pool.query(
        'select id from article_comments where id = $1 and article_id = $2 and hidden = false',
        [parentId, articleId],
      );
      if (!p.length) return res.status(400).json({ error: 'Parent comment not found.' });
    }

    const { rows } = await pool.query(
      `insert into article_comments (article_id, user_id, body, parent_id)
       values ($1, $2, $3, $4)
       returning id, body, created_at, parent_id`,
      [articleId, req.user.id, body, parentId],
    );
    const summary = await articleEngagementSummary(articleId, req.user.id);
    res.status(201).json({
      item: {
        id: rows[0].id,
        body: rows[0].body,
        createdAt: rows[0].created_at,
        parentId: rows[0].parent_id,
        author: {
          id: req.user.id,
          name: req.user.displayName || req.user.email.split('@')[0],
        },
      },
      engagement: summary,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/engagement/publishers/follow  { organizationId } or { journalistId }
router.post('/publishers/follow', ...requireContributor, async (req, res, next) => {
  try {
    const organizationId = req.body.organizationId ? Number(req.body.organizationId) : null;
    const journalistId = req.body.journalistId ? Number(req.body.journalistId) : null;
    if ((!organizationId && !journalistId) || (organizationId && journalistId)) {
      return res.status(400).json({ error: 'Provide organizationId or journalistId (one only).' });
    }

    if (organizationId) {
      const { rows } = await pool.query('select id from organizations where id = $1 and active = true', [organizationId]);
      if (!rows.length) return res.status(404).json({ error: 'Publisher not found.' });
      const { rows: existing } = await pool.query(
        'select id from publisher_follows where user_id = $1 and organization_id = $2',
        [req.user.id, organizationId],
      );
      if (existing.length) {
        await pool.query('delete from publisher_follows where id = $1', [existing[0].id]);
        return res.json({ ok: true, following: false });
      }
      await pool.query(
        'insert into publisher_follows (user_id, organization_id) values ($1, $2) on conflict do nothing',
        [req.user.id, organizationId],
      );
      return res.json({ ok: true, following: true });
    }

    const { rows } = await pool.query('select id from journalists where id = $1', [journalistId]);
    if (!rows.length) return res.status(404).json({ error: 'Journalist not found.' });
    const { rows: existing } = await pool.query(
      'select id from publisher_follows where user_id = $1 and journalist_id = $2',
      [req.user.id, journalistId],
    );
    if (existing.length) {
      await pool.query('delete from publisher_follows where id = $1', [existing[0].id]);
      return res.json({ ok: true, following: false });
    }
    await pool.query(
      'insert into publisher_follows (user_id, journalist_id) values ($1, $2) on conflict do nothing',
      [req.user.id, journalistId],
    );
    res.json({ ok: true, following: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/engagement/publishers/:slug — public org profile + follow state + recent stories
router.get('/publishers/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id, name, slug, org_type, description, logo_url, website_url,
              verification_status, is_official, active
       from organizations where slug = $1`,
      [req.params.slug],
    );
    const org = rows[0];
    if (!org || !org.active) return res.status(404).json({ error: 'Publisher not found.' });

    const [followers, stories, following] = await Promise.all([
      pool.query('select count(*)::int as c from publisher_follows where organization_id = $1', [org.id]),
      pool.query(
        `select id, title, summary, slug, internal_url, image_url, published_at, status
         from articles
         where organization_id = $1 and status = 'published' and hidden = false
         order by published_at desc nulls last
         limit 30`,
        [org.id],
      ),
      req.user && isContributor(req.user)
        ? pool.query(
          'select 1 from publisher_follows where user_id = $1 and organization_id = $2',
          [req.user.id, org.id],
        )
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        orgType: org.org_type,
        description: org.description,
        logoUrl: org.logo_url,
        websiteUrl: org.website_url,
        verificationStatus: org.verification_status,
        isOfficial: org.is_official,
        badge: org.is_official
          ? 'Official 256 Update'
          : (org.verification_status === 'approved' ? 'Verified publisher' : 'Registered publisher'),
        followerCount: followers.rows[0].c,
        profileUrl: `/publisher/${org.slug}`,
      },
      following: following.rows.length > 0,
      canEngage: isContributor(req.user),
      authenticated: Boolean(req.user),
      stories: stories.rows.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        imageUrl: s.image_url,
        publishedAt: s.published_at,
        url: s.internal_url || (s.slug ? `/news/${s.slug}` : null),
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.isContributor = isContributor;
module.exports.CONTRIBUTOR_ROLES = CONTRIBUTOR_ROLES;
