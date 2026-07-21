const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const pool = require('./db');
const { crawlAllSources, crawlNewsApiSources, crawlGoogleNewsTopics } = require('../scripts/crawl');
const { loadSessionUser, requireRole } = require('./auth');
const authRoutes = require('./routes/auth');
const publisherApplicationRoutes = require('./routes/publisherApplications');
const publisherProfileRoutes = require('./routes/publishers');
const publisherAdminRoutes = require('./routes/publisherAdmin');
const storyRoutes = require('./routes/stories');
const meStoryRoutes = require('./routes/meStories');
const taxonomyRoutes = require('./routes/taxonomy');
const feedRoutes = require('./routes/feeds');
const { pollDueFeeds } = require('./feedImport');
const rssRoutes = require('./routes/rss');
const ecosystemAdminRoutes = require('./routes/ecosystemAdmin');
const platformNewsRoutes = require('./routes/platformNews');
const storyPageRoutes = require('./routes/storyPages');
const { runEcosystemAutomationCycle } = require('./ecosystemScheduler');
const { generateStorySummary, generatePendingStorySummaries } = require('./storySummaries');

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = express();
const port = Number(process.env.PORT || 5066);

app.set('trust proxy', true);
app.use(helmet({ contentSecurityPolicy: false }));
// The session-cookie-bearing app is locked to 256newsroom's own origins.
// /api/platforms/*/news is a public, credential-less read endpoint meant to
// be fetched cross-origin from the individual platform sites, so it gets a
// permissive, no-credentials CORS policy instead — resolved per-request so
// there's only ever one `cors()` middleware in the stack (two stacked
// instances previously produced conflicting Access-Control-* headers).
app.use(cors((req, callback) => {
  if (req.path.startsWith('/api/platforms/')) {
    callback(null, { origin: true, credentials: false });
  } else {
    callback(null, { origin: ['https://256newsroom.com', 'https://www.256newsroom.com'], credentials: true });
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(loadSessionUser);

app.use('/api/auth', authRoutes);
app.use('/api/publisher-applications', publisherApplicationRoutes);
app.use('/api/admin/publisher-applications', publisherApplicationRoutes.adminRouter);
// Order matters: numeric-id admin/story routes are tried before the slug-based public
// profile route, which acts as the catch-all fallback for /api/publishers/:slug.
app.use('/api/publishers', publisherAdminRoutes);
app.use('/api/publishers', storyRoutes);
app.use('/api/publishers', feedRoutes);
app.use('/api/admin/feeds', feedRoutes.adminRouter);
app.use('/api/publishers', publisherProfileRoutes);
app.use('/api/me/stories', meStoryRoutes);
app.use('/api', taxonomyRoutes);
app.use('/rss', rssRoutes);
app.use('/api/admin/ecosystem', ecosystemAdminRoutes);
app.use('/api/platforms', platformNewsRoutes);
app.use(storyPageRoutes);

// Accepts either the legacy static admin token (existing ops/cron callers) or a
// logged-in super_admin/newsroom_admin session — the static-token path is kept only
// for backward compatibility during rollout and is a fast-follow removal candidate.
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const provided = req.header('x-admin-token');
  if (expected && provided === expected) return next();
  return requireRole('super_admin', 'newsroom_admin')(req, res, next);
}

const citizenReportAttempts = new Map();
function citizenReportRateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 5;
  const attempts = (citizenReportAttempts.get(ip) || []).filter((t) => now - t < windowMs);
  if (attempts.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many reports submitted from this connection. Please try again later.' });
  }
  attempts.push(now);
  citizenReportAttempts.set(ip, attempts);
  next();
}

const articleSelect = `
  select
    a.id, a.title, a.summary, a.url, a.original_url, a.internal_url, a.slug, a.image_url, a.author, a.published_at, a.score,
    coalesce(s.name, o.name, '256 Newsroom') as source_name, coalesce(s.slug, o.slug, '256-newsroom') as source_slug,
    coalesce(s.source_type, o.org_type, 'newsroom') as source_type, coalesce(s.official, o.is_official, false) as official,
    s.credibility_label,
    c.name as category, c.slug as category_slug,
    d.name as district, d.slug as district_slug
  from articles a
  left join sources s on s.id = a.source_id
  left join organizations o on o.id = a.organization_id
  left join categories c on c.id = a.category_id
  left join districts d on d.id = a.district_id
  where a.hidden = false and a.status = 'published'
`;

const ecosystemSearchSql = `
  lower(coalesce(a.title, '') || ' ' || coalesce(a.summary, '') || ' ' || coalesce(a.url, '')) similar to
  '%(256 heart|256heart|256 corporate|256corporate|256 mall|256mall|256 express|256express|256shield|256 shield|256 ai|256ai|256 ai systems|256linkshield|256 linkshield|256 ecosystem|256 group|queen dorothy amolo|dorothy amolo|jason boyle|r. boyle|r boyle|enterprise.256|shield.256|ai.256)%'
`;

// Today's Uganda-local-day articles are ranked ahead of everything else; older
// articles still show, just pushed further down instead of dropped.
const todayFirstOrder = `(date_trunc('day', a.published_at at time zone 'Africa/Kampala') = date_trunc('day', now() at time zone 'Africa/Kampala')) desc nulls last`;

function limitParam(req, fallback = 12, max = 50) {
  const value = Number(req.query.limit || fallback);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, max);
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    originalUrl: row.original_url || row.url,
    internalUrl: row.internal_url || (row.slug ? `/news/${row.slug}` : null),
    slug: row.slug,
    imageUrl: row.image_url,
    author: row.author,
    publishedAt: row.published_at,
    score: Number(row.score || 0),
    source: {
      name: row.source_name,
      slug: row.source_slug,
      type: row.source_type,
      official: row.official,
      credibilityLabel: row.credibility_label,
    },
    category: row.category ? { name: row.category, slug: row.category_slug } : null,
    district: row.district ? { name: row.district, slug: row.district_slug } : null,
  }));
}

app.get('/api/health', async (_req, res) => {
  const db = await pool.query('select now() as now');
  res.json({ ok: true, service: '256-newsroom-api', databaseTime: db.rows[0].now });
});

function interleave(primary, secondary) {
  if (!secondary.length) return primary;
  const result = [];
  const step = Math.max(1, Math.floor(primary.length / (secondary.length + 1)));
  let secIndex = 0;
  primary.forEach((item, i) => {
    result.push(item);
    if ((i + 1) % step === 0 && secIndex < secondary.length) {
      result.push(secondary[secIndex++]);
    }
  });
  while (secIndex < secondary.length) result.push(secondary[secIndex++]);
  return result;
}

// 256 Newsroom is a Uganda-focused outlet: the hero/top-story rotation should be
// Uganda news first, with only a handful of major international stories mixed in.
app.get('/api/news/hero', async (req, res, next) => {
  try {
    const limit = limitParam(req, 12);
    const internationalCap = Math.max(1, Math.min(3, Math.round(limit * 0.2)));
    const ugandaLimit = limit - internationalCap;
    const [ugandaRows, intlRows] = await Promise.all([
      pool.query(`${articleSelect} and s.source_type <> 'international_publisher' and (c.slug is distinct from 'sports') order by ${todayFirstOrder}, (a.image_url is not null) desc, a.score desc, a.published_at desc nulls last limit $1`, [ugandaLimit]),
      pool.query(`${articleSelect} and s.source_type = 'international_publisher' and (c.slug is distinct from 'sports') order by ${todayFirstOrder}, (a.image_url is not null) desc, a.score desc, a.published_at desc nulls last limit $1`, [internationalCap]),
    ]);
    const items = interleave(normalizeRows(ugandaRows.rows), normalizeRows(intlRows.rows));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/top', async (req, res, next) => {
  try {
    const limit = limitParam(req, 12);
    const { rows } = await pool.query(`${articleSelect} order by ${todayFirstOrder}, (a.image_url is not null) desc, a.score desc, a.published_at desc nulls last limit $1`, [limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/latest', async (req, res, next) => {
  try {
    const limit = limitParam(req, 18);
    const { rows } = await pool.query(`${articleSelect} order by ${todayFirstOrder}, a.published_at desc nulls last, a.fetched_at desc limit $1`, [limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/ecosystem', async (req, res, next) => {
  try {
    const limit = limitParam(req, 12);
    const { rows } = await pool.query(`
      ${articleSelect}
      and (c.slug = 'ecosystem' or ${ecosystemSearchSql})
      order by ${todayFirstOrder}, a.published_at desc nulls last, a.fetched_at desc
      limit $1
    `, [limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/mentions', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 120);
    if (!q) return res.json({ items: [] });
    const limit = limitParam(req, 12);
    const { rows } = await pool.query(`
      ${articleSelect}
      and (a.title ilike '%' || $1 || '%' or a.summary ilike '%' || $1 || '%')
      order by ${todayFirstOrder}, a.published_at desc nulls last, a.fetched_at desc
      limit $2
    `, [q, limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/category/:category', async (req, res, next) => {
  try {
    const limit = limitParam(req, 12);
    const { rows } = await pool.query(`${articleSelect} and c.slug = $1 order by ${todayFirstOrder}, a.published_at desc nulls last limit $2`, [req.params.category, limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/district/:district', async (req, res, next) => {
  try {
    const limit = limitParam(req, 12);
    const { rows } = await pool.query(`${articleSelect} and d.slug = $1 order by ${todayFirstOrder}, a.published_at desc nulls last limit $2`, [req.params.district, limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/districts/latest', async (req, res, next) => {
  try {
    const limit = limitParam(req, 18);
    const { rows } = await pool.query(`
      ${articleSelect}
      and (d.id is not null or c.slug = 'district')
      order by ${todayFirstOrder}, a.published_at desc nulls last, a.fetched_at desc
      limit $1
    `, [limit]);
    res.json({ items: normalizeRows(rows) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/news/sources/top', async (req, res, next) => {
  try {
    const limit = limitParam(req, 10);
    const { rows } = await pool.query(`
      select s.id, s.name, s.slug, s.source_type, s.official, s.credibility_label,
        count(a.id)::int as article_count, coalesce(sum(a.score), 0)::numeric as score
      from sources s
      left join articles a on a.source_id = s.id and a.hidden = false and a.status = 'published'
      where s.active = true and s.approved = true
      group by s.id
      order by score desc, article_count desc, s.name asc
      limit $1
    `, [limit]);
    res.json({ items: rows.map((row) => ({ ...row, score: Number(row.score || 0) })) });
  } catch (err) {
    next(err);
  }
});

// Ranked by published story count, not fabricated engagement figures — no genuine
// reads/views/shares tracking exists yet (see backend/sql/migrations/0008_*).
app.get('/api/journalists/top', async (req, res, next) => {
  try {
    const limit = limitParam(req, 6);
    const { rows } = await pool.query(`
      select j.id, j.name, j.slug, j.beat, j.profile_url, j.image_url, j.verified, j.trust_score,
        count(a.id)::int as published_story_count,
        max(a.published_at) as most_recent_published_at
      from journalists j
      left join articles a on a.journalist_id = j.id and a.status = 'published'
      group by j.id
      order by published_story_count desc, most_recent_published_at desc nulls last, j.name asc
      limit $1
    `, [limit]);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

// Real published stories from the internally-seeded 256 Ecosystem organization and its
// active child platforms — never a hardcoded array. Organizations are flagged
// is_official=true only via internal seeding (backend/sql/migrations/0009_*), never
// through public registration, so this can't be spoofed by a third-party publisher.
// featured_in_ecosystem lets an admin control the homepage widget without unpublishing
// a story. Deliberately unrelated to the general "ecosystem" news category, which may
// contain independent third-party coverage about 256 companies rather than official
// updates from them.
app.get('/api/ecosystem', async (req, res, next) => {
  try {
    const limit = limitParam(req, 10, 50);
    const { rows } = await pool.query(`
      select
        a.id, a.title, a.summary, a.published_at, a.slug, a.external_url, a.content_type,
        o.name as platform, o.slug as org_slug, o.logo_url, o.website_url
      from articles a
      join organizations o on o.id = a.organization_id
      where a.featured_in_ecosystem = true
        and a.status = 'published'
        and o.active = true
        and o.is_official = true
        and o.verification_status = 'approved'
      order by a.published_at desc nulls last
      limit $1
    `, [limit]);
    res.json({
      items: rows.map((row) => ({
        platform: row.platform,
        logoUrl: row.logo_url,
        title: row.title,
        summary: row.summary,
        publishedAt: row.published_at,
        contentType: row.content_type,
        articleUrl: row.slug ? `/${row.org_slug}/${row.slug}` : null,
        externalUrl: row.external_url || row.website_url || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/citizen-reports', citizenReportRateLimit, async (req, res, next) => {
  try {
    const description = String(req.body.description || '').trim().slice(0, 2000);
    const districtSlug = req.body.districtSlug ? String(req.body.districtSlug).trim() : null;
    const anonymous = Boolean(req.body.anonymous);
    if (!description) return res.status(400).json({ error: 'Please describe what you are seeing.' });
    const title = description.length > 80 ? `${description.slice(0, 77)}...` : description;
    const districtId = districtSlug
      ? (await pool.query('select id from districts where slug = $1', [districtSlug])).rows[0]?.id || null
      : null;
    const { rows } = await pool.query(`
      insert into citizen_reports (title, description, district_id, anonymous, status)
      values ($1, $2, $3, $4, 'pending')
      returning id, status
    `, [title, description, districtId, anonymous]);
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

app.post('/api/crawl/run', requireAdmin, async (_req, res, next) => {
  try {
    const result = await crawlAllSources();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/crawl/run-newsapi', requireAdmin, async (_req, res, next) => {
  try {
    const result = await crawlNewsApiSources();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/crawl/run-googlenews', requireAdmin, async (_req, res, next) => {
  try {
    const result = await crawlGoogleNewsTopics();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/articles/:id/generate-summary', requireAdmin, async (req, res, next) => {
  try {
    res.json(await generateStorySummary(req.params.id));
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/sources', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select s.*, c.slug as default_category_slug, c.name as default_category
      from sources s
      left join categories c on c.id = s.default_category_id
      order by s.approved asc, s.active desc, s.name
    `);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/sources', requireAdmin, async (req, res, next) => {
  try {
    const {
      name,
      slug,
      homepageUrl,
      feedUrl,
      sourceType = 'local_publisher',
      defaultCategorySlug = null,
      official = false,
      credibilityLabel = null,
      adminNotes = null,
      active = true,
      approved = true,
    } = req.body;
    const categoryId = defaultCategorySlug
      ? (await pool.query('select id from categories where slug = $1', [defaultCategorySlug])).rows[0]?.id
      : null;
    const { rows } = await pool.query(`
      insert into sources
        (name, slug, homepage_url, feed_url, source_type, default_category_id, official, credibility_label, admin_notes, active, approved)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      on conflict (slug) do update set
        name = excluded.name,
        homepage_url = excluded.homepage_url,
        feed_url = excluded.feed_url,
        source_type = excluded.source_type,
        default_category_id = excluded.default_category_id,
        official = excluded.official,
        credibility_label = excluded.credibility_label,
        admin_notes = excluded.admin_notes,
        active = excluded.active,
        approved = excluded.approved,
        updated_at = now()
      returning *
    `, [name, slug, homepageUrl, feedUrl, sourceType, categoryId, official, credibilityLabel, adminNotes, active, approved]);
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/articles/:id', requireAdmin, async (req, res, next) => {
  try {
    const { hidden, status, categorySlug, districtSlug } = req.body;
    const categoryId = categorySlug ? (await pool.query('select id from categories where slug = $1', [categorySlug])).rows[0]?.id : null;
    const districtId = districtSlug ? (await pool.query('select id from districts where slug = $1', [districtSlug])).rows[0]?.id : null;
    const { rows } = await pool.query(`
      update articles set
        hidden = coalesce($2, hidden),
        status = coalesce($3, status),
        category_id = coalesce($4, category_id),
        district_id = coalesce($5, district_id),
        updated_at = now()
      where id = $1
      returning *
    `, [req.params.id, hidden, status, categoryId, districtId]);
    res.json({ item: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/citizen-reports', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select cr.*, d.name as district
      from citizen_reports cr
      left join districts d on d.id = cr.district_id
      order by cr.created_at desc
      limit 100
    `);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/citizen-reports/:id', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const { rows } = await pool.query('update citizen_reports set status = $2 where id = $1 returning *', [req.params.id, status]);
    res.json({ item: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/crawl-logs', requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select cl.*, s.name as source_name
      from crawl_logs cl
      left join sources s on s.id = cl.source_id
      order by cl.started_at desc
      limit 50
    `);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  const message = status < 500 ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
});

if (process.env.CRAWL_INTERVAL_MINUTES !== '0') {
  const minutes = Math.max(10, Number(process.env.CRAWL_INTERVAL_MINUTES || 30));
  cron.schedule(`*/${minutes} * * * *`, () => {
    crawlAllSources().catch((err) => console.error('Scheduled crawl failed:', err));
  });
}

if (process.env.NEWSAPI_KEY && process.env.NEWSAPI_INTERVAL_MINUTES !== '0') {
  const minutes = Math.max(60, Number(process.env.NEWSAPI_INTERVAL_MINUTES || 120));
  const hours = Math.max(1, Math.round(minutes / 60));
  cron.schedule(`0 */${hours} * * *`, () => {
    crawlNewsApiSources().catch((err) => console.error('Scheduled NewsAPI crawl failed:', err));
  });
}

if (process.env.GOOGLENEWS_INTERVAL_MINUTES !== '0') {
  const minutes = Math.max(15, Number(process.env.GOOGLENEWS_INTERVAL_MINUTES || 30));
  cron.schedule(`*/${minutes} * * * *`, () => {
    crawlGoogleNewsTopics().catch((err) => console.error('Scheduled Google News crawl failed:', err));
  });
}

if (process.env.FEED_IMPORT_INTERVAL_MINUTES !== '0') {
  const minutes = Math.max(5, Number(process.env.FEED_IMPORT_INTERVAL_MINUTES || 15));
  cron.schedule(`*/${minutes} * * * *`, () => {
    pollDueFeeds().catch((err) => console.error('Scheduled feed import failed:', err));
  });
}

if (process.env.STORY_SUMMARY_INTERVAL_MINUTES && process.env.STORY_SUMMARY_INTERVAL_MINUTES !== '0') {
  const minutes = Math.max(15, Number(process.env.STORY_SUMMARY_INTERVAL_MINUTES));
  cron.schedule(`*/${minutes} * * * *`, () => {
    generatePendingStorySummaries(3).catch((err) => console.error('Scheduled story-summary generation failed:', err));
  });
}

// Off by default (ECOSYSTEM_AUTOMATION_INTERVAL_MINUTES=0) — every platform
// is also individually in 'draft' mode by default (see automation_settings),
// so this needs two explicit opt-ins before anything can auto-publish.
if (process.env.ECOSYSTEM_AUTOMATION_INTERVAL_MINUTES && process.env.ECOSYSTEM_AUTOMATION_INTERVAL_MINUTES !== '0') {
  const minutes = Math.max(15, Number(process.env.ECOSYSTEM_AUTOMATION_INTERVAL_MINUTES));
  console.log(`Ecosystem automation cron enabled: running every ${minutes} minutes.`);
  cron.schedule(`*/${minutes} * * * *`, () => {
    console.log('Ecosystem automation cycle starting...');
    runEcosystemAutomationCycle()
      .then((result) => console.log('Ecosystem automation cycle finished:', JSON.stringify(result.results?.map((r) => `${r.name}:${r.status}`) || result)))
      .catch((err) => console.error('Scheduled ecosystem automation cycle failed:', err));
  });
}

app.listen(port, () => {
  console.log(`256 Newsroom API listening on ${port}`);
});
