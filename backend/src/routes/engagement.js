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

const REASON_MIN = 15;
const REASON_MAX = 2000;

function isContributor(user) {
  if (!user?.roles?.length) return false;
  const allowed = new Set(CONTRIBUTOR_ROLES);
  return user.roles.some((r) => allowed.has(r.key));
}

function mapAuthor(row) {
  return {
    id: row.user_id,
    name: row.journalist_name || row.display_name || (row.email ? row.email.split('@')[0] : 'Member'),
    profileUrl: row.journalist_slug
      ? `/journalists/profile.html?slug=${encodeURIComponent(row.journalist_slug)}`
      : null,
  };
}

function mapStance(row) {
  return {
    id: row.id,
    stance: row.stance,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: mapAuthor(row),
  };
}

async function articleEngagementSummary(articleId, userId = null) {
  const [likes, agrees, disagrees, comments, mineLike, mineStance] = await Promise.all([
    pool.query('select count(*)::int as c from article_likes where article_id = $1', [articleId]),
    pool.query(
      `select count(*)::int as c from article_debate_stances
       where article_id = $1 and stance = 'agree' and hidden = false`,
      [articleId],
    ),
    pool.query(
      `select count(*)::int as c from article_debate_stances
       where article_id = $1 and stance = 'disagree' and hidden = false`,
      [articleId],
    ),
    pool.query(
      'select count(*)::int as c from article_comments where article_id = $1 and hidden = false',
      [articleId],
    ),
    userId
      ? pool.query(
        'select exists(select 1 from article_likes where article_id = $1 and user_id = $2) as liked',
        [articleId, userId],
      )
      : Promise.resolve({ rows: [{ liked: false }] }),
    userId
      ? pool.query(
        `select stance, reason from article_debate_stances
         where article_id = $1 and user_id = $2 and hidden = false`,
        [articleId, userId],
      )
      : Promise.resolve({ rows: [] }),
  ]);

  const my = mineStance.rows[0] || null;
  return {
    likes: likes.rows[0].c,
    agrees: agrees.rows[0].c,
    disagrees: disagrees.rows[0].c,
    // Back-compat for older clients
    upvotes: agrees.rows[0].c,
    comments: comments.rows[0].c,
    liked: Boolean(mineLike.rows[0]?.liked),
    upvoted: my?.stance === 'agree',
    myStance: my?.stance || null,
    myReason: my?.reason || null,
  };
}

async function requirePublishedArticle(articleId) {
  const { rows } = await pool.query(
    `select id from articles where id = $1 and status = 'published' and hidden = false`,
    [articleId],
  );
  return rows[0] || null;
}

async function listDebateStances(articleId, stanceFilter = null) {
  const params = [articleId];
  let stanceSql = '';
  if (stanceFilter === 'agree' || stanceFilter === 'disagree') {
    params.push(stanceFilter);
    stanceSql = ` and s.stance = $${params.length}`;
  }
  const { rows } = await pool.query(
    `select s.id, s.stance, s.reason, s.created_at, s.updated_at,
            u.id as user_id, u.display_name, u.email,
            j.name as journalist_name, j.slug as journalist_slug
     from article_debate_stances s
     join users u on u.id = s.user_id
     left join journalists j on j.user_id = u.id
     where s.article_id = $1 and s.hidden = false${stanceSql}
     order by s.updated_at desc
     limit 200`,
    params,
  );
  return rows.map(mapStance);
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
      title: a.title,
      scope: 'article',
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

// GET /api/engagement/articles/:id/debate — agree/disagree arguments for this article
router.get('/articles/:id/debate', async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    if (!(await requirePublishedArticle(articleId))) {
      return res.status(404).json({ error: 'Article not found.' });
    }
    const stance = req.query.stance ? String(req.query.stance) : null;
    const items = await listDebateStances(articleId, stance);
    const summary = await articleEngagementSummary(articleId, req.user?.id || null);
    res.json({
      articleId,
      items,
      agrees: items.filter((i) => i.stance === 'agree'),
      disagrees: items.filter((i) => i.stance === 'disagree'),
      engagement: summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/engagement/articles/:id/debate
 * Body: { stance: 'agree'|'disagree', reason: string }
 * One stance per user per article; updating switches side and replaces the reason.
 * Reason is required (min 15 chars) so every position starts a debate argument.
 */
router.post('/articles/:id/debate', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    if (!(await requirePublishedArticle(articleId))) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    const stance = String(req.body.stance || '').toLowerCase().trim();
    if (stance !== 'agree' && stance !== 'disagree') {
      return res.status(400).json({ error: 'Choose agree or disagree.' });
    }

    const reason = String(req.body.reason || req.body.explanation || req.body.why || '').trim();
    if (reason.length < REASON_MIN) {
      return res.status(400).json({
        error: `Please explain why (at least ${REASON_MIN} characters). Debate needs a reason.`,
      });
    }
    if (reason.length > REASON_MAX) {
      return res.status(400).json({ error: `Reason is too long (max ${REASON_MAX} characters).` });
    }

    const { rows } = await pool.query(
      `insert into article_debate_stances (article_id, user_id, stance, reason, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (article_id, user_id) do update set
         stance = excluded.stance,
         reason = excluded.reason,
         hidden = false,
         updated_at = now()
       returning id, stance, reason, created_at, updated_at`,
      [articleId, req.user.id, stance, reason],
    );

    // Keep legacy upvote table roughly in sync for any old consumers.
    if (stance === 'agree') {
      await pool.query(
        `insert into article_upvotes (article_id, user_id) values ($1, $2) on conflict do nothing`,
        [articleId, req.user.id],
      );
    } else {
      await pool.query(
        'delete from article_upvotes where article_id = $1 and user_id = $2',
        [articleId, req.user.id],
      );
    }

    const summary = await articleEngagementSummary(articleId, req.user.id);
    const debate = await listDebateStances(articleId);
    res.status(201).json({
      ok: true,
      item: {
        id: rows[0].id,
        stance: rows[0].stance,
        reason: rows[0].reason,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
        author: {
          id: req.user.id,
          name: req.user.displayName || req.user.email.split('@')[0],
        },
      },
      engagement: summary,
      debate,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/engagement/articles/:id/debate — withdraw your stance
router.delete('/articles/:id/debate', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    await pool.query(
      'delete from article_debate_stances where article_id = $1 and user_id = $2',
      [articleId, req.user.id],
    );
    await pool.query(
      'delete from article_upvotes where article_id = $1 and user_id = $2',
      [articleId, req.user.id],
    );
    const summary = await articleEngagementSummary(articleId, req.user.id);
    const debate = await listDebateStances(articleId);
    res.json({ ok: true, engagement: summary, debate });
  } catch (err) {
    next(err);
  }
});

// POST /api/engagement/articles/:id/like  — toggle like (simple, no reason)
router.post('/articles/:id/like', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    if (!(await requirePublishedArticle(articleId))) {
      return res.status(404).json({ error: 'Article not found.' });
    }

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

// POST /api/engagement/articles/:id/upvote — legacy alias for agree-with-reason
router.post('/articles/:id/upvote', ...requireContributor, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    if (!(await requirePublishedArticle(articleId))) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    const reason = String(req.body.reason || req.body.explanation || '').trim();
    if (reason.length < REASON_MIN) {
      const { rows: existing } = await pool.query(
        `select id, stance from article_debate_stances where article_id = $1 and user_id = $2`,
        [articleId, req.user.id],
      );
      if (existing.length && existing[0].stance === 'agree') {
        await pool.query('delete from article_debate_stances where id = $1', [existing[0].id]);
        await pool.query(
          'delete from article_upvotes where article_id = $1 and user_id = $2',
          [articleId, req.user.id],
        );
        const summary = await articleEngagementSummary(articleId, req.user.id);
        return res.json({ ok: true, engagement: summary, withdrawn: true });
      }
      return res.status(400).json({
        error: `To agree, explain why (at least ${REASON_MIN} characters).`,
        requiresReason: true,
        minChars: REASON_MIN,
      });
    }

    const { rows } = await pool.query(
      `insert into article_debate_stances (article_id, user_id, stance, reason, updated_at)
       values ($1, $2, 'agree', $3, now())
       on conflict (article_id, user_id) do update set
         stance = 'agree', reason = excluded.reason, hidden = false, updated_at = now()
       returning id, stance, reason, created_at, updated_at`,
      [articleId, req.user.id, reason],
    );
    await pool.query(
      `insert into article_upvotes (article_id, user_id) values ($1, $2) on conflict do nothing`,
      [articleId, req.user.id],
    );
    const summary = await articleEngagementSummary(articleId, req.user.id);
    res.status(201).json({
      ok: true,
      item: {
        id: rows[0].id,
        stance: rows[0].stance,
        reason: rows[0].reason,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      },
      engagement: summary,
    });
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
        author: mapAuthor(r),
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

    if (!(await requirePublishedArticle(articleId))) {
      return res.status(404).json({ error: 'Article not found.' });
    }

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
