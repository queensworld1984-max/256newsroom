const express = require('express');
const pool = require('../db');

const router = express.Router();
const SITE = 'https://256newsroom.com';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeUrl(value, fallback = SITE) {
  try {
    const url = new URL(value, SITE);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.toString()) : fallback;
  } catch {
    return fallback;
  }
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(value) {
  if (!value) return 'Publication time unavailable';
  return new Intl.DateTimeFormat('en-UG', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Kampala',
  }).format(new Date(value));
}

function storyJsonLd(story, canonical, description, imageUrl) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: story.title,
    description,
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: story.published_at,
    dateModified: story.updated_at,
    author: story.author ? [{ '@type': 'Person', name: story.author }] : [{ '@type': 'Organization', name: story.publisher_name }],
    publisher: { '@type': 'Organization', name: '256 Newsroom', url: SITE },
    isBasedOn: story.original_url,
    mainEntityOfPage: canonical,
  }).replace(/</g, '\\u003c');
}

function renderCoverage(items) {
  if (!items.length) return '<p class="empty-note">No additional verified coverage is currently clustered with this report.</p>';
  return `<ul class="coverage-list">${items.map((item) => `
    <li><a href="${escapeHtml(item.internal_url)}">${escapeHtml(item.title)}</a><span>${escapeHtml(item.publisher_name)}</span></li>
  `).join('')}</ul>`;
}

function renderRelated(items) {
  if (!items.length) return '<p class="empty-note">No related reports are available yet.</p>';
  return `<div class="related-grid">${items.map((item) => `
    <a class="related-card" href="${escapeHtml(item.internal_url)}">
      ${item.image_url ? `<img src="${safeUrl(item.image_url)}" alt="" loading="lazy">` : '<span class="related-placeholder">256</span>'}
      <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.publisher_name)}</small>
    </a>
  `).join('')}</div>`;
}

function renderSummary(summary) {
  return String(summary || '').split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`).join('');
}

function renderArticleBody(body) {
  return String(body || '').split(/\n{2,}/).filter(Boolean).map((block) => {
    const text = block.trim();
    if (/^##\s+/.test(text)) return `<h2>${escapeHtml(text.replace(/^##\s+/, ''))}</h2>`;
    const disclosure = text.match(/^\*([^*]+)\*$/s);
    if (disclosure) return `<p class="story-disclosure"><em>${escapeHtml(disclosure[1])}</em></p>`;
    return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

router.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select a.internal_url, a.updated_at
      from articles a
      where a.hidden = false and a.status = 'published'
        and a.internal_url is not null
        and a.summary_is_original = true
        and array_length(regexp_split_to_array(trim(coalesce(a.seo_summary, a.summary, '')), '\\s+'), 1) between 200 and 300
      order by a.updated_at desc
      limit 50000
    `);
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc></url>${rows.map((row) => `\n  <url><loc>${SITE}${escapeHtml(row.internal_url)}</loc><lastmod>${new Date(row.updated_at).toISOString()}</lastmod></url>`).join('')}\n</urlset>`);
  } catch (err) {
    next(err);
  }
});

router.get('/news/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select a.*, coalesce(s.name, o.name, '256 Newsroom') as publisher_name,
        s.slug as publisher_slug, s.homepage_url, o.logo_url as publisher_logo,
        c.name as category_name, c.slug as category_slug,
        d.name as district_name, d.slug as district_slug
      from articles a
      left join sources s on s.id = a.source_id
      left join organizations o on o.id = a.organization_id
      left join categories c on c.id = a.category_id
      left join districts d on d.id = a.district_id
      where a.slug = $1 and a.hidden = false and a.status = 'published'
      limit 1
    `, [req.params.slug]);
    const story = rows[0];
    if (!story) return res.status(404).type('html').send('<!doctype html><title>Story not found | 256 Newsroom</title><h1>Story not found</h1><p><a href="/">Return to 256 Newsroom</a></p>');

    const [coverageResult, relatedResult] = await Promise.all([
      story.cluster_id ? pool.query(`
        select a.title, a.internal_url, coalesce(s.name, o.name, '256 Newsroom') as publisher_name
        from articles a left join sources s on s.id = a.source_id left join organizations o on o.id = a.organization_id
        where a.cluster_id = $1 and a.id <> $2 and a.hidden = false and a.status = 'published' and a.internal_url is not null
        order by a.published_at desc nulls last limit 12
      `, [story.cluster_id, story.id]) : { rows: [] },
      pool.query(`
        select a.title, a.internal_url, a.image_url, coalesce(s.name, o.name, '256 Newsroom') as publisher_name
        from articles a left join sources s on s.id = a.source_id left join organizations o on o.id = a.organization_id
        where a.id <> $1 and a.hidden = false and a.status = 'published' and a.internal_url is not null
          and (a.category_id = $2 or ($3::bigint is not null and a.district_id = $3))
        order by (a.district_id = $3) desc nulls last, a.published_at desc nulls last limit 6
      `, [story.id, story.category_id, story.district_id]),
    ]);

    const summary = String(story.seo_summary || story.summary || '').trim();
    // Breaking-news publishers should not be penalized while they are still the
    // only source covering an event. A validated, independently worded digest is
    // sufficient for indexing; additional publishers enhance the page later.
    const substantive = story.summary_is_original && wordCount(summary) >= 200 && wordCount(summary) <= 300;
    const internalCanonical = `${SITE}${story.internal_url}`;
    const canonical = substantive ? internalCanonical : story.original_url;
    const description = summary.slice(0, 160) || `${story.title} — report attributed to ${story.publisher_name}.`;
    const imageUrl = story.image_url || null;
    const originalUrl = safeUrl(story.original_url);
    const publisherLogo = story.publisher_logo
      ? `<img src="${safeUrl(story.publisher_logo)}" alt="${escapeHtml(story.publisher_name)} logo">`
      : `<span>${escapeHtml(story.publisher_name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2))}</span>`;

    res.set('Cache-Control', 'public, max-age=120');
    res.status(200).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(story.title)} | 256 Newsroom</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${substantive ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">
<link rel="canonical" href="${safeUrl(canonical)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="256 Newsroom">
<meta property="og:title" content="${escapeHtml(story.title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${safeUrl(internalCanonical)}">${imageUrl ? `<meta property="og:image" content="${safeUrl(imageUrl)}">` : ''}
<meta property="article:published_time" content="${escapeHtml(story.published_at || '')}"><meta property="article:modified_time" content="${escapeHtml(story.updated_at || '')}">
<script type="application/ld+json">${storyJsonLd(story, canonical, description, imageUrl)}</script>
<link rel="stylesheet" href="/story.css?v=20260721"></head>
<body><header class="site-head"><a href="/" class="brand">256 <b>Newsroom</b></a><span>Uganda's Digital News Infrastructure</span></header>
<main class="story-shell"><nav class="crumbs"><a href="/">Home</a> / ${story.category_name ? `<a href="/#${escapeHtml(story.category_slug)}">${escapeHtml(story.category_name)}</a> / ` : ''}<span>Story summary</span></nav>
<article><div class="story-kicker">${escapeHtml(story.category_name || 'News')}${story.district_name ? ` · ${escapeHtml(story.district_name)}` : ''}</div>
<h1>${escapeHtml(story.title)}</h1>
<div class="publisher"><div class="publisher-logo">${publisherLogo}</div><div><strong>${escapeHtml(story.publisher_name)}</strong><span>${story.author ? `By ${escapeHtml(story.author)} · ` : ''}${escapeHtml(formatDate(story.published_at))}</span></div></div>
${imageUrl ? `<figure><img src="${safeUrl(imageUrl)}" alt="${escapeHtml(story.title)}" decoding="async" fetchpriority="high"><figcaption>Featured image supplied by or retrieved from ${escapeHtml(story.publisher_name)}.</figcaption></figure>` : ''}
<section class="summary"><h2>${story.body ? 'Full report' : 'What the report says'}</h2>${story.body ? renderArticleBody(story.body) : renderSummary(summary || 'A substantive summary is not yet available. Use the publisher link below to read the complete report.')}</section>
<a class="original-button" href="${originalUrl}" target="_blank" rel="noopener sponsored">Read the full report at ${escapeHtml(story.publisher_name)} →</a>
<section><h2>Other publishers covering this story</h2>${renderCoverage(coverageResult.rows)}</section>
<section><h2>Related reporting</h2>${renderRelated(relatedResult.rows)}</section>
</article></main><footer>256 Newsroom aggregates and attributes reporting. Complete articles remain with their original publishers.</footer></body></html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
