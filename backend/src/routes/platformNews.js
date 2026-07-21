const express = require('express');
const pool = require('../db');

const router = express.Router();
const NEWSROOM_SITE = 'https://256newsroom.com';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeUrl(value, fallback = '#') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.toString()) : fallback;
  } catch { return fallback; }
}

function renderBody(body) {
  return String(body || '').split(/\n{2,}/).filter(Boolean).map((block) => {
    const text = block.trim();
    if (/^##\s+/.test(text)) return `<h2>${escapeHtml(text.replace(/^##\s+/, ''))}</h2>`;
    const disclosure = text.match(/^\*([^*]+)\*$/s);
    if (disclosure) return `<p class="disclosure"><em>${escapeHtml(disclosure[1])}</em></p>`;
    return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function pageShell({ title, description, canonical, imageUrl, jsonLd, platform, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${safeUrl(canonical)}"><meta property="og:type" content="${jsonLd ? 'article' : 'website'}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${safeUrl(canonical)}">${imageUrl ? `<meta property="og:image" content="${safeUrl(imageUrl)}">` : ''}
<meta name="twitter:card" content="summary_large_image">${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
<style>*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:#151515;font:16px/1.7 Arial,sans-serif}header{background:#111;color:#fff;padding:18px 5vw;display:flex;align-items:center;justify-content:space-between}header a{color:#fff;text-decoration:none}.brand{font-size:21px;font-weight:800}.brand b,.kicker{color:#c79a2b}nav a{margin-left:20px}main{max-width:1040px;margin:auto;padding:56px 24px 90px}h1{font:800 clamp(34px,6vw,64px)/1.05 Georgia,serif;max-width:900px;margin:12px 0 22px}h2{font:800 27px/1.2 Georgia,serif;margin:42px 0 12px}.lede{font-size:19px;color:#555;max-width:760px}.meta{color:#666;margin:0 0 28px}.hero{width:100%;max-height:560px;object-fit:cover;margin:12px 0 30px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;margin-top:36px}.card{background:#fff;border:1px solid #ddd;padding:24px;text-decoration:none;color:inherit}.card h2{font-size:22px;margin:8px 0}.card p{color:#555}.card time{font-size:12px;color:#777}.article{max-width:780px}.article p{font-size:18px}.backlinks{border-top:1px solid #ccc;margin-top:48px;padding-top:24px}.backlinks a{color:#7c5b00;font-weight:700}.disclosure{background:#eee9dc;padding:15px}footer{text-align:center;border-top:1px solid #ddd;padding:28px;color:#666}@media(max-width:650px){nav{display:none}main{padding-top:38px}}</style></head><body>
<header><a class="brand" href="/">${escapeHtml(platform.name)}</a><nav><a href="/">Home</a><a href="/news">News</a><a href="${NEWSROOM_SITE}/#ecosystem">256 Newsroom</a></nav></header>${body}<footer>Official ${escapeHtml(platform.name)} news, distributed with 256 Newsroom.</footer></body></html>`;
}

async function getPlatform(slug) {
  const { rows } = await pool.query(`select id,name,slug,logo_url,website_url from organizations where slug=$1 and active=true and is_official=true and verification_status='approved'`, [slug]);
  return rows[0] || null;
}

// CORS for this path is handled by the dynamic resolver in server.js
// (permissive, no credentials — this is a public read-only endpoint).
router.get('/:slug/news', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const { rows: orgRows } = await pool.query(
      `select id, name, slug, logo_url, website_url from organizations
       where slug = $1 and active = true and is_official = true and verification_status = 'approved'`,
      [req.params.slug],
    );
    const org = orgRows[0];
    if (!org) return res.status(404).json({ error: 'Unknown or unapproved platform.' });

    const { rows } = await pool.query(
      `select a.id, a.title, a.summary, a.published_at, a.slug, a.external_url, a.content_type, a.image_url
       from articles a
       where a.organization_id = $1 and a.status = 'published' and a.hidden = false
       order by a.published_at desc nulls last
       limit $2`,
      [org.id, limit],
    );

    res.set('Cache-Control', 'public, max-age=120');
    res.json({
      platform: { name: org.name, slug: org.slug, logoUrl: org.logo_url, websiteUrl: org.website_url },
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        publishedAt: row.published_at,
        contentType: row.content_type,
        imageUrl: row.image_url,
        sourceUrl: row.external_url,
        publicUrl: `${NEWSROOM_SITE}/news/${row.slug}`,
        platformUrl: `${org.website_url.replace(/\/$/, '')}/news/${row.slug}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:slug/news-page', async (req, res, next) => {
  try {
    const org = await getPlatform(req.params.slug);
    if (!org) return res.status(404).send('Platform not found');
    const { rows } = await pool.query(`select title,summary,published_at,slug,content_type from articles where organization_id=$1 and status='published' and hidden=false order by published_at desc nulls last limit 100`, [org.id]);
    const canonical = `${org.website_url.replace(/\/$/, '')}/news`;
    const description = `Official news, service guides and product updates from ${org.name}.`;
    const cards = rows.map((item) => `<a class="card" href="/news/${encodeURIComponent(item.slug)}"><span class="kicker">${escapeHtml(item.content_type || 'Official update')}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary || '')}</p><time>${item.published_at ? new Date(item.published_at).toLocaleDateString('en-UG', { dateStyle: 'long', timeZone: 'Africa/Kampala' }) : ''}</time></a>`).join('');
    res.set('Cache-Control', 'public,max-age=120').type('html').send(pageShell({ title: `News | ${org.name}`, description, canonical, platform: org, body: `<main><span class="kicker">Official updates</span><h1>${escapeHtml(org.name)} News</h1><p class="lede">${escapeHtml(description)} Every report is prepared from verified information and published through 256 Newsroom.</p><div class="grid">${cards || '<p>No published updates yet.</p>'}</div></main>` }));
  } catch (err) { next(err); }
});

router.get('/:slug/news-page/:articleSlug', async (req, res, next) => {
  try {
    const org = await getPlatform(req.params.slug);
    if (!org) return res.status(404).send('Platform not found');
    const { rows } = await pool.query(`select title,summary,body,published_at,updated_at,slug,content_type,image_url from articles where organization_id=$1 and slug=$2 and status='published' and hidden=false limit 1`, [org.id, req.params.articleSlug]);
    const article = rows[0];
    if (!article) return res.status(404).send('Article not found');
    const canonical = `${org.website_url.replace(/\/$/, '')}/news/${article.slug}`;
    const newsroomUrl = `${NEWSROOM_SITE}/news/${article.slug}`;
    const description = String(article.summary || '').slice(0, 160);
    const jsonLd = { '@context':'https://schema.org', '@type':'NewsArticle', headline:article.title, description, image:article.image_url ? [article.image_url] : undefined, datePublished:article.published_at, dateModified:article.updated_at, author:{'@type':'Organization',name:org.name,url:org.website_url}, publisher:{'@type':'Organization',name:org.name,url:org.website_url}, mainEntityOfPage:canonical, isBasedOn:org.website_url };
    const body = `<main class="article"><span class="kicker">${escapeHtml(article.content_type || 'Official update')}</span><h1>${escapeHtml(article.title)}</h1><p class="lede">${escapeHtml(article.summary || '')}</p><p class="meta">Published ${article.published_at ? new Date(article.published_at).toLocaleDateString('en-UG', { dateStyle:'long', timeZone:'Africa/Kampala' }) : ''} · ${escapeHtml(org.name)}</p>${article.image_url ? `<img class="hero" src="${safeUrl(article.image_url)}" alt="${escapeHtml(article.title)}" fetchpriority="high">` : ''}${renderBody(article.body || article.summary)}<div class="backlinks"><p>Also distributed and independently archived by <a href="${safeUrl(newsroomUrl)}">256 Newsroom</a>.</p><p><a href="/news">← More ${escapeHtml(org.name)} news</a></p></div></main>`;
    res.set('Cache-Control', 'public,max-age=120').type('html').send(pageShell({ title:`${article.title} | ${org.name}`, description, canonical, imageUrl:article.image_url, jsonLd, platform:org, body }));
  } catch (err) { next(err); }
});

module.exports = router;
