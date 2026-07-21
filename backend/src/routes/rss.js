const express = require('express');
const pool = require('../db');
const { buildRssXml, sendRss } = require('../rssFeeds');

const router = express.Router();

const SITE_URL = 'https://256newsroom.com';

// Shared by every feed below: only published, non-hidden rows, and — for
// organization-authored/imported content — only from an org that is active
// and either approved or an internal 256 platform. Crawled articles and
// independent-journalist articles (organization_id null) carry no org gate.
// This is the single choke point that keeps drafts, scheduled, withdrawn,
// private, suspended-publisher and unapproved-org content out of every feed.
const PUBLIC_ROW_WHERE = `
  a.status = 'published' and a.hidden = false
  and (a.organization_id is null or (o.active = true and (o.verification_status = 'approved' or o.is_official = true)))
`;

const BASE_SELECT = `
  select
    a.id, a.title, a.summary, a.body, a.url, a.external_url, a.image_url, a.author,
    a.published_at, a.slug, a.origin,
    c.name as category_name, c.slug as category_slug,
    d.name as district_name, d.slug as district_slug,
    o.name as org_name, o.slug as org_slug,
    j.name as journalist_name, j.slug as journalist_slug,
    s.name as source_name
  from articles a
  left join categories c on c.id = a.category_id
  left join districts d on d.id = a.district_id
  left join organizations o on o.id = a.organization_id
  left join journalists j on j.id = a.journalist_id
  left join sources s on s.id = a.source_id
  where ${PUBLIC_ROW_WHERE}
`;

// Individual publisher-authored/independent story permalink pages don't
// exist on the site yet (crawled articles link straight to their original
// source, which is all that's needed there). Until that lands, org-authored
// stories link to the org's existing public profile page and independent
// journalists' stories link to their existing /journalists/:slug profile —
// both real, already-served pages — rather than inventing a URL that 404s.
function articleLink(row) {
  if (row.origin === 'external_feed_import') return row.external_url || row.url;
  if (row.origin === 'publisher_authored' && row.org_slug) return `${SITE_URL}/${row.org_slug}`;
  if (row.origin === 'publisher_authored' && row.journalist_slug) return `${SITE_URL}/journalists/${row.journalist_slug}`;
  return row.url;
}

function toRssItem(row) {
  return {
    title: row.title,
    link: articleLink(row),
    guid: `${SITE_URL}/articles/${row.id}`,
    guidIsLink: false,
    publishedAt: row.published_at,
    description: row.summary || (row.body ? String(row.body).slice(0, 500) : null),
    category: row.category_name,
    author: row.journalist_name || row.org_name || row.source_name || null,
    imageUrl: row.image_url,
  };
}

router.get('/latest.xml', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${BASE_SELECT} order by a.published_at desc nulls last limit 50`);
    sendRss(res, buildRssXml({
      title: '256 Newsroom — Latest',
      description: 'The latest published stories across 256 Newsroom, from Uganda-wide aggregation and verified publishers.',
      link: SITE_URL,
      selfUrl: `${SITE_URL}/rss/latest.xml`,
      items: rows.map(toRssItem),
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:category.xml', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${BASE_SELECT} and c.slug = $1 order by a.published_at desc nulls last limit 50`,
      [req.params.category],
    );
    if (!rows.length) {
      const exists = await pool.query('select 1 from categories where slug = $1', [req.params.category]);
      if (!exists.rows.length) return res.status(404).json({ error: 'Unknown category.' });
    }
    sendRss(res, buildRssXml({
      title: `256 Newsroom — ${rows[0]?.category_name || req.params.category}`,
      description: `Published stories in the ${rows[0]?.category_name || req.params.category} category.`,
      link: `${SITE_URL}/#${req.params.category}`,
      selfUrl: `${SITE_URL}/rss/categories/${req.params.category}.xml`,
      items: rows.map(toRssItem),
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/districts/:district.xml', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${BASE_SELECT} and d.slug = $1 order by a.published_at desc nulls last limit 50`,
      [req.params.district],
    );
    if (!rows.length) {
      const exists = await pool.query('select 1 from districts where slug = $1', [req.params.district]);
      if (!exists.rows.length) return res.status(404).json({ error: 'Unknown district.' });
    }
    sendRss(res, buildRssXml({
      title: `256 Newsroom — ${rows[0]?.district_name || req.params.district} District`,
      description: `Published stories from ${rows[0]?.district_name || req.params.district} district.`,
      link: `${SITE_URL}/#districts`,
      selfUrl: `${SITE_URL}/rss/districts/${req.params.district}.xml`,
      items: rows.map(toRssItem),
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/publishers/:publisher.xml', async (req, res, next) => {
  try {
    const { rows: orgRows } = await pool.query(
      `select id, name, slug from organizations
       where slug = $1 and active = true and (verification_status = 'approved' or is_official = true)`,
      [req.params.publisher],
    );
    const org = orgRows[0];
    if (!org) return res.status(404).json({ error: 'Publisher not found or not approved.' });

    const { rows } = await pool.query(
      `${BASE_SELECT} and a.organization_id = $1 order by a.published_at desc nulls last limit 50`,
      [org.id],
    );
    sendRss(res, buildRssXml({
      title: `${org.name} — via 256 Newsroom`,
      description: `Published stories from ${org.name}.`,
      link: `${SITE_URL}/${org.slug}`,
      selfUrl: `${SITE_URL}/rss/publishers/${org.slug}.xml`,
      items: rows.map(toRssItem),
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/ecosystem.xml', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${BASE_SELECT} and a.featured_in_ecosystem = true and o.is_official = true order by a.published_at desc nulls last limit 50`,
    );
    sendRss(res, buildRssXml({
      title: '256 Newsroom — 256 Ecosystem Updates',
      description: 'Official updates from 256 AI Technologies and its platforms.',
      link: `${SITE_URL}/#ecosystem`,
      selfUrl: `${SITE_URL}/rss/ecosystem.xml`,
      items: rows.map(toRssItem),
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/platforms/:platform.xml', async (req, res, next) => {
  try {
    const { rows: orgRows } = await pool.query(
      `select id, name, slug from organizations where slug = $1 and active = true and is_official = true`,
      [req.params.platform],
    );
    const org = orgRows[0];
    if (!org) return res.status(404).json({ error: 'Unknown 256 platform.' });

    const { rows } = await pool.query(
      `${BASE_SELECT} and a.organization_id = $1 order by a.published_at desc nulls last limit 50`,
      [org.id],
    );
    sendRss(res, buildRssXml({
      title: `${org.name} — 256 Newsroom`,
      description: `Updates from ${org.name}.`,
      link: `${SITE_URL}/${org.slug}`,
      selfUrl: `${SITE_URL}/rss/platforms/${org.slug}.xml`,
      items: rows.map(toRssItem),
    }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
