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

function articleBlocks(body) {
  return String(body || '').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
}

function pickPullQuote(body, summary) {
  const candidates = articleBlocks(body)
    .filter((block) => !/^##\s+/.test(block) && !/^\*[^*]+\*$/.test(block))
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 80 && sentence.length <= 240);
  return candidates.sort((a, b) => b.length - a.length)[0] || String(summary || '').trim().slice(0, 240);
}

function readingMinutes(body, summary) {
  const words = String(body || summary || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

function renderBody(body, pullQuote = '') {
  const blocks = articleBlocks(body);
  const paragraphTotal = blocks.filter((block) => !/^##\s+/.test(block) && !/^\*[^*]+\*$/s.test(block)).length;
  const quoteAfter = Math.min(2, paragraphTotal);
  let paragraphCount = 0;
  return blocks.map((block) => {
    const text = block.trim();
    if (/^##\s+/.test(text)) return `<h2>${escapeHtml(text.replace(/^##\s+/, ''))}</h2>`;
    const disclosure = text.match(/^\*([^*]+)\*$/s);
    if (disclosure) return `<p class="disclosure"><em>${escapeHtml(disclosure[1])}</em></p>`;
    paragraphCount += 1;
    const paragraph = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
    return paragraphCount === quoteAfter && pullQuote
      ? `${paragraph}<blockquote class="pull-quote"><p>${escapeHtml(pullQuote)}</p><cite>${escapeHtml('From the official ')}${escapeHtml('platform report')}</cite></blockquote>`
      : paragraph;
  }).join('');
}

function pageShell({ title, description, canonical, imageUrl, jsonLd, platform, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${safeUrl(canonical)}"><meta property="og:type" content="${jsonLd ? 'article' : 'website'}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${safeUrl(canonical)}">${imageUrl ? `<meta property="og:image" content="${safeUrl(imageUrl)}">` : ''}
<meta name="twitter:card" content="summary_large_image">${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght%40400;500;600;700&family=DM+Serif+Display&family=Inconsolata:wght%40500;700&family=PT+Serif:ital,wght%400,400%3B0,700%3B1,400&family=Playfair+Display:ital,wght%400,600%3B0,700%3B0,900%3B1,600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:#151515;font:19px/1.7 "PT Serif",Georgia,serif}header{background:#111;color:#fff;padding:18px 5vw;display:flex;align-items:center;justify-content:space-between}header a{color:#fff;text-decoration:none}.brand{font-size:21px;font-weight:800}.brand b,.kicker{color:#c79a2b}nav a{margin-left:20px}main{max-width:1040px;margin:auto;padding:56px 24px 90px}h1{font:400 clamp(34px,6vw,64px)/1.08 "DM Serif Display",Georgia,serif;max-width:900px;margin:12px 0 22px}h2{font:400 27px/1.2 "DM Serif Display",Georgia,serif;margin:42px 0 12px}.lede{font-size:19px;color:#555;max-width:760px}.meta{color:#666;margin:0 0 28px}.hero{width:100%;max-height:560px;object-fit:cover;margin:12px 0 30px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;margin-top:36px}.card{background:#fff;border:1px solid #d4d0c5;border-top:4px solid #c79a2b;padding:26px;text-decoration:none;color:inherit;cursor:pointer;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s}.card:hover,.card:focus{transform:translateY(-3px);box-shadow:0 12px 28px #0002;outline:2px solid #c79a2b}.card h2{font-size:24px;margin:8px 0;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}.card p{color:#4d4d4d}.card time{font-size:12px;color:#777}.read-more{display:inline-block;margin-top:auto;padding-top:18px;color:#171100;font-weight:800;text-decoration:underline}.article{max-width:780px}.article p{font-size:20px}.backlinks{border-top:1px solid #ccc;margin-top:48px;padding-top:24px}.backlinks a{color:#7c5b00;font-weight:700}.disclosure{background:#eee9dc;padding:15px}footer{text-align:center;border-top:1px solid #ddd;padding:28px;color:#666}
.editorial-article{max-width:1180px}.dateline-rail{border-top:1px solid #171717;border-bottom:1px solid #171717;display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:space-between;padding:8px 0;font:700 12px/1.3 Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase}.dateline-rail span:last-child{color:#8d161b}.article-header{padding:26px 0 0}.article-header h1{max-width:1020px}.article-header .lede{font-size:21px;line-height:1.55;max-width:850px}.article-byline{align-items:center;border-top:1px solid #bbb3a4;border-bottom:4px double #171717;display:flex;gap:14px;margin-top:28px;padding:15px 0}.byline-avatar{align-items:center;background:#111;border:2px solid #c79a2b;border-radius:50%;color:#fff;display:flex;flex:0 0 46px;font:700 13px/1 Arial,sans-serif;height:46px;justify-content:center;overflow:hidden}.byline-avatar img{height:100%;object-fit:contain;width:100%}.byline-copy{line-height:1.25}.byline-copy strong{display:block;font-size:17px}.byline-copy span,.byline-stat small{color:#666;display:block;font:700 10px/1.3 Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase}.byline-stats{display:flex;gap:26px;margin-left:auto}.byline-stat strong{display:block;font:700 14px/1.3 Arial,sans-serif}.article-figure{margin:30px 0 38px}.article-figure .hero{display:block;margin:0;max-height:620px}.article-figure figcaption{border-bottom:1px solid #ccc4b5;color:#6b665e;font-size:14px;line-height:1.4;padding:8px 0}.article-layout{display:grid;gap:54px;grid-template-columns:minmax(0,760px) minmax(220px,280px)}.story-copy>p{font-size:20px;margin:0 0 24px}.story-copy>p:first-of-type::first-letter{color:#171717;float:left;font:400 82px/.72 "DM Serif Display",Georgia,serif;margin:12px 10px 0 0}.story-copy h2{border-top:1px solid #bdb6a8;font-size:30px;margin:48px 0 18px;padding-top:17px}.story-copy h2::before{color:#a9181d;content:"◆";font-size:.52em;margin-right:.65em;vertical-align:.18em}.pull-quote{border-left:5px solid #a9181d;color:#211e19;font:400 29px/1.22 "DM Serif Display",Georgia,serif;margin:42px 0;padding:18px 20px 18px 48px;position:relative}.pull-quote span{color:#c79a2b;font:400 84px/.7 Georgia,serif;left:9px;position:absolute;top:19px}.story-facts{align-self:start;border-top:5px solid #171717;position:sticky;top:24px}.story-facts h2{border-bottom:2px solid #a9181d;font-size:25px;margin:0;padding:14px 0 10px}.fact-row{border-bottom:1px dashed #aaa296;padding:13px 0}.fact-row span{color:#766f66;display:block;font:700 10px/1.3 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.fact-row strong,.fact-row a{color:#171717;font-size:17px;line-height:1.3}.fact-row a{text-decoration-color:#a9181d;text-underline-offset:3px}.tag-rail{align-items:center;border-top:1px solid #171717;border-bottom:1px solid #171717;display:flex;flex-wrap:wrap;gap:8px;margin-top:48px;padding:12px 0}.tag-rail>span{font:700 10px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.story-tag{background:#e8e2d5;border-radius:999px;font:700 12px/1 Arial,sans-serif;padding:8px 11px}.editorial-backlinks{margin-top:32px}.editorial-backlinks p{font-size:17px}.disclosure{background:#eee9dc;padding:15px}
footer{text-align:center;border-top:1px solid #ddd;padding:28px;color:#666}
.site-masthead{background:#f7f5f0;border-bottom:1px solid #15130f;padding:18px 48px}.site-masthead .brand-logo{display:block;height:76px}.site-masthead .brand-logo img{display:block;height:100%;max-width:290px;object-fit:contain;object-position:left center}.site-masthead nav a{color:#15130f;font:700 11px/1 "Inconsolata",monospace;letter-spacing:1.2px;text-transform:uppercase}.article-crumb{border-bottom:1px solid #d9d3c4;color:#4a463d;font:500 11px/1.4 "Inconsolata",monospace;letter-spacing:1.5px;padding:14px 48px;text-transform:uppercase}.article-crumb a{color:#a11d1d;text-decoration:none}.article-crumb .sep{color:#d9d3c4;margin:0 8px}.reference-story{max-width:1180px;padding:52px 48px 0}.reference-story .eyebrow-row{align-items:center;display:flex;gap:14px;margin-bottom:18px}.reference-story .eyebrow{border-bottom:2px solid #a11d1d;color:#a11d1d;font:700 12px/1.4 "Inconsolata",monospace;letter-spacing:2.5px;padding-bottom:3px;text-transform:uppercase}.reference-story .dateline{color:#8a621f;font:500 11px/1.4 "Inconsolata",monospace;letter-spacing:1.5px;text-transform:uppercase}.reference-story h1.headline{font:900 clamp(38px,5vw,58px)/1.06 "Playfair Display",Georgia,serif;letter-spacing:-.5px;margin:0 0 28px;max-width:920px}.reference-story .byline-row{align-items:center;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;padding:18px 0}.reference-story .byline-left{align-items:center;display:flex;gap:14px}.reference-story .avatar{align-items:center;background:#15130f;border:2px solid #b9872f;border-radius:50%;color:#b9872f;display:flex;font:700 15px/1 "Playfair Display",serif;height:46px;justify-content:center;overflow:hidden;width:46px}.reference-story .avatar img{height:100%;object-fit:contain;width:100%}.reference-story .byline-name{font-size:16px;font-weight:700}.reference-story .byline-sub{color:#4a463d;font:500 11px/1.4 "Inconsolata",monospace;letter-spacing:1px;margin-top:2px;text-transform:uppercase}.reference-story .byline-stats{color:#4a463d;display:flex;font:500 11px/1.3 "Inconsolata",monospace;gap:22px;letter-spacing:1px;text-transform:uppercase}.reference-story .stat{display:flex;flex-direction:column;gap:2px}.reference-story .stat strong{color:#a11d1d;font:700 15px/1.1 "Playfair Display",serif}.reference-story .rule-double{border-bottom:1px solid #15130f;border-top:3px solid #15130f;height:9px;margin:4px 0 40px}.reference-story .story-grid{display:grid;gap:64px;grid-template-columns:minmax(0,1fr) 300px;padding-bottom:60px}.reference-story .story-main>p{color:#26231d;font-size:19px;line-height:1.75;margin:0 0 26px}.reference-story .story-main>p:first-of-type::first-letter{color:#a11d1d;float:left;font:900 92px/.78 "Playfair Display",Georgia,serif;padding:8px 10px 0 0}.reference-story .story-main h2{align-items:center;border:0;display:flex;font:700 27px/1.3 "Playfair Display",Georgia,serif;gap:12px;margin:34px 0 20px;padding:0}.reference-story .story-main h2::before{background:#a11d1d;content:"";display:inline-block;flex:0 0 8px;height:8px;margin:0;transform:rotate(45deg);width:8px}.reference-story blockquote.pull-quote{border-left:3px solid #b9872f;margin:44px 0;padding:6px 0 6px 30px;position:relative}.reference-story blockquote.pull-quote::before{color:#b9872f;content:"“";font:600 80px/1 "Playfair Display",serif;left:-6px;opacity:.55;position:absolute;top:-34px}.reference-story blockquote.pull-quote p{color:#15130f;font:italic 700 26px/1.4 "Playfair Display",serif;margin:0}.reference-story blockquote.pull-quote cite{color:#4a463d;display:block;font:500 11px/1.5 "Inconsolata",monospace;letter-spacing:1.5px;margin-top:10px;text-transform:uppercase}.story-rail{display:flex;flex-direction:column;gap:28px}.rail-box{background:#efece3;border:1px solid #15130f}.rail-head{background:#15130f;color:#b9872f;font:700 11px/1.3 "Inconsolata",monospace;letter-spacing:2px;padding:10px 16px;text-transform:uppercase}.rail-body{padding:18px 16px}.facts{margin:0}.facts .row{border-bottom:1px dashed #d9d3c4;display:flex;gap:10px;justify-content:space-between;padding:10px 0}.facts .row:last-child{border-bottom:0}.facts dt{color:#4a463d;font:500 10.5px/1.4 "Inconsolata",monospace;letter-spacing:1px;margin:0;text-transform:uppercase}.facts dd{font-size:14px;font-weight:700;margin:0;text-align:right}.facts dd a{color:#a11d1d}.rail-tags{display:flex;flex-wrap:wrap;gap:8px;padding:18px 16px}.rail-tag{border:1px solid #15130f;color:#4a463d;font:500 10.5px/1 "Inconsolata",monospace;letter-spacing:1px;padding:6px 12px;text-transform:uppercase}.rail-tag:first-child{background:#a11d1d;border-color:#a11d1d;color:#fff}.rail-note{border-top:1px solid #d9d3c4;color:#4a463d;font:500 11.5px/1.7 "Inconsolata",monospace;padding:16px}.reference-story .story-footer{align-items:center;border-top:2px solid #15130f;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;padding:26px 0 60px}.reference-story .fline{color:#4a463d;font:500 11px/1.5 "Inconsolata",monospace;letter-spacing:1.5px;text-transform:uppercase}.reference-story .fline b{color:#8a621f}.reference-story .disclosure{background:#efece3;padding:15px}
@media(max-width:920px){.site-masthead{align-items:flex-start;padding:14px 20px}.site-masthead .brand-logo{height:60px}.article-crumb{padding:12px 20px}.reference-story{padding:32px 20px 0}.reference-story .story-grid{gap:36px;grid-template-columns:1fr}.reference-story .story-main>p:first-of-type::first-letter{font-size:60px}}@media(max-width:650px){.site-masthead nav{display:none}.reference-story .eyebrow-row{align-items:flex-start;flex-direction:column;gap:8px}.reference-story .byline-stats{width:100%}}</style></head><body>
<header class="site-masthead"><a class="brand-logo" href="${NEWSROOM_SITE}" aria-label="256 Newsroom home"><img src="${NEWSROOM_SITE}/assets/logos/256-newsroom.png" alt="256 Newsroom"></a><nav><a href="/news">${escapeHtml(platform.name)} News</a><a href="${NEWSROOM_SITE}/#ecosystem">256 Ecosystem</a></nav></header>${body}<footer>Official ${escapeHtml(platform.name)} news, distributed with 256 Newsroom.</footer></body></html>`;
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
    const { rows } = await pool.query(`select title,summary,body,published_at,slug,content_type from articles where organization_id=$1 and status='published' and hidden=false order by published_at desc nulls last limit 100`, [org.id]);
    const canonical = `${org.website_url.replace(/\/$/, '')}/news`;
    const description = `Official news, service guides and product updates from ${org.name}.`;
    const cards = rows.map((item) => {
      const preview = String(item.body || item.summary || '').replace(/^##\s+.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 520);
      return `<a class="card" href="/news/${encodeURIComponent(item.slug)}" aria-label="Read full article: ${escapeHtml(item.title)}"><span class="kicker">${escapeHtml(item.content_type || 'Official update')}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(preview)}${preview.length >= 520 ? '…' : ''}</p><time>${item.published_at ? new Date(item.published_at).toLocaleDateString('en-UG', { dateStyle: 'long', timeZone: 'Africa/Kampala' }) : ''}</time><span class="read-more">Read full article →</span></a>`;
    }).join('');
    res.set('Cache-Control', 'public,max-age=120').type('html').send(pageShell({ title: `News | ${org.name}`, description, canonical, platform: org, body: `<main><span class="kicker">Official updates</span><h1>${escapeHtml(org.name)} News</h1><p class="lede">${escapeHtml(description)} Every report is prepared from verified information and published through 256 Newsroom.</p><div class="grid">${cards || '<p>No published updates yet.</p>'}</div></main>` }));
  } catch (err) { next(err); }
});

router.get('/:slug/news-page/:articleSlug', async (req, res, next) => {
  try {
    const org = await getPlatform(req.params.slug);
    if (!org) return res.status(404).send('Platform not found');
    const { rows } = await pool.query(`select title,summary,body,published_at,updated_at,slug,content_type,image_url,tags from articles where organization_id=$1 and slug=$2 and status='published' and hidden=false limit 1`, [org.id, req.params.articleSlug]);
    const article = rows[0];
    if (!article) return res.status(404).send('Article not found');
    const canonical = `${org.website_url.replace(/\/$/, '')}/news/${article.slug}`;
    const newsroomUrl = `${NEWSROOM_SITE}/news/${article.slug}`;
    const description = String(article.summary || '').slice(0, 160);
    const jsonLd = { '@context':'https://schema.org', '@type':'NewsArticle', headline:article.title, description, image:article.image_url ? [article.image_url] : undefined, datePublished:article.published_at, dateModified:article.updated_at, author:{'@type':'Organization',name:org.name,url:org.website_url}, publisher:{'@type':'Organization',name:org.name,url:org.website_url}, mainEntityOfPage:canonical, isBasedOn:org.website_url };
    const publishedDate = article.published_at ? new Date(article.published_at).toLocaleDateString('en-UG', { dateStyle:'long', timeZone:'Africa/Kampala' }) : 'Publication date unavailable';
    const dateline = article.published_at ? new Date(article.published_at).toLocaleDateString('en-UG', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Africa/Kampala' }) : publishedDate;
    const publishedTime = article.published_at ? new Date(article.published_at).toLocaleTimeString('en-UG', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Africa/Kampala' }) : '';
    const pullQuote = pickPullQuote(article.body, article.summary);
    const readTime = readingMinutes(article.body, article.summary);
    const initials = org.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
    const avatar = org.logo_url
      ? `<img src="${safeUrl(org.logo_url)}" alt="${escapeHtml(org.name)} logo">`
      : `<span>${escapeHtml(initials)}</span>`;
    const articleTags = [...new Set([article.content_type || 'Official update', ...(Array.isArray(article.tags) ? article.tags : [])])].filter(Boolean).slice(0, 6);
    const railTags = articleTags.map((tag) => `<span class="rail-tag">${escapeHtml(tag)}</span>`).join('');
    const footerTags = articleTags.slice(0, 3).map((tag) => `<b>${escapeHtml(tag)}</b>`).join(' · ');
    const body = `<div class="article-crumb"><a href="${NEWSROOM_SITE}">Home</a><span class="sep">/</span><a href="/news">${escapeHtml(org.name)} News</a><span class="sep">/</span><span>Story Summary</span></div>
    <main class="reference-story"><article>
      <div class="eyebrow-row"><span class="eyebrow">${escapeHtml(article.content_type || 'Official update')}</span><span class="dateline">Uganda · ${escapeHtml(dateline)}</span></div>
      <h1 class="headline">${escapeHtml(article.title)}</h1>
      <div class="byline-row"><div class="byline-left"><div class="avatar">${avatar}</div><div><div class="byline-name">${escapeHtml(org.name)} Newsdesk</div><div class="byline-sub">Published ${escapeHtml(publishedDate)}${publishedTime ? ` · ${escapeHtml(publishedTime)} EAT` : ''}</div></div></div><div class="byline-stats"><div class="stat"><strong>${readTime}</strong>min read</div><div class="stat"><strong>A</strong>staff report</div><div class="stat"><strong>✓</strong>official source</div></div></div>
      <div class="rule-double"></div>
      ${article.image_url ? `<figure class="article-figure"><img class="hero" src="${safeUrl(article.image_url)}" alt="${escapeHtml(article.title)}" fetchpriority="high"><figcaption>Official image from ${escapeHtml(org.name)}.</figcaption></figure>` : ''}
      <div class="story-grid"><div class="story-main">${renderBody(article.body || article.summary, pullQuote)}</div>
        <aside class="story-rail" aria-label="Story information"><div class="rail-box"><div class="rail-head">Story Facts</div><div class="rail-body"><dl class="facts"><div class="row"><dt>Product</dt><dd>${escapeHtml(org.name)}</dd></div><div class="row"><dt>Category</dt><dd>${escapeHtml(article.content_type || 'Official update')}</dd></div><div class="row"><dt>Market</dt><dd>Uganda</dd></div><div class="row"><dt>Published</dt><dd>${escapeHtml(publishedDate)}</dd></div><div class="row"><dt>Access</dt><dd><a href="${safeUrl(org.website_url)}">Visit platform ↗</a></dd></div></dl></div></div>
          <div class="rail-box"><div class="rail-head">Related Tags</div><div class="rail-tags">${railTags}</div><div class="rail-note">Filed under 256 Newsroom’s continuing coverage of Uganda’s digital ecosystem.</div></div></aside>
      </div>
      <div class="story-footer"><div class="fline">Tags: ${footerTags}</div><div class="fline"><a href="/news">← Back to ${escapeHtml(org.name)} News</a> · <a href="${safeUrl(newsroomUrl)}">256 Newsroom archive</a></div></div>
    </article></main>`;
    res.set('Cache-Control', 'public,max-age=120').type('html').send(pageShell({ title:`${article.title} | ${org.name}`, description, canonical, imageUrl:article.image_url, jsonLd, platform:org, body }));
  } catch (err) { next(err); }
});

module.exports = router;
