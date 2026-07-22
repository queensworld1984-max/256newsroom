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
      ${item.image_url ? `<img src="${safeUrl(item.image_url)}" alt="" loading="lazy">` : '<img class="related-placeholder" src="/assets/logos/256-newsroom.png" alt="256 Newsroom">'}
      <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.publisher_name)}</small>
    </a>
  `).join('')}</div>`;
}

/** More stories by the same journalist, or by journalists under the same publisher. */
function renderJournalistStories(items, { journalistName, publisherName, journalistSlug }) {
  if (!items.length) {
    return '<p class="empty-note">No other published stories from this journalist yet.</p>';
  }
  const profile = journalistSlug
    ? `<p class="journalist-more-link"><a href="/journalists/profile.html?slug=${escapeHtml(journalistSlug)}">View ${escapeHtml(journalistName || 'journalist')} profile →</a></p>`
    : '';
  return `${profile}<div class="related-grid journalist-stories-grid">${items.map((item) => {
    const href = escapeHtml(item.internal_url || (item.slug ? `/news/${item.slug}` : '#'));
    const byline = item.journalist_name
      ? `${item.journalist_name}${item.publisher_name ? ` · ${item.publisher_name}` : ''}`
      : (item.publisher_name || publisherName || '256 Newsroom');
    const when = item.published_at
      ? new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeZone: 'Africa/Kampala' }).format(new Date(item.published_at))
      : '';
    return `
    <a class="related-card" href="${href}">
      ${item.image_url ? `<img src="${safeUrl(item.image_url)}" alt="" loading="lazy">` : '<img class="related-placeholder" src="/assets/logos/256-newsroom.png" alt="256 Newsroom">'}
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(byline)}${when ? ` · ${escapeHtml(when)}` : ''}</small>
    </a>`;
  }).join('')}</div>`;
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
    const [{ rows }, { rows: categoryRows }, { rows: districtRows }] = await Promise.all([pool.query(`
      select a.internal_url, a.updated_at
      from articles a
      where a.hidden = false and a.status = 'published'
        and a.internal_url is not null
        and a.summary_is_original = true
        and array_length(regexp_split_to_array(trim(coalesce(a.seo_summary, a.summary, '')), '\\s+'), 1) between 200 and 300
      order by a.updated_at desc
      limit 50000
    `), pool.query(`select slug from categories where is_active and (navbar_visibility or parent_category_id is not null)`), pool.query('select slug from districts')]);
    const taxonomyUrls = ['/latest', ...categoryRows.map(r => `/${r.slug}`), '/districts', ...districtRows.map(r => `/districts/${r.slug}`)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc></url>${taxonomyUrls.map(url => `\n  <url><loc>${SITE}${escapeHtml(url)}</loc></url>`).join('')}${rows.map((row) => `\n  <url><loc>${SITE}${escapeHtml(row.internal_url)}</loc><lastmod>${new Date(row.updated_at).toISOString()}</lastmod></url>`).join('')}\n</urlset>`);
  } catch (err) {
    next(err);
  }
});

router.get('/news/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select a.*, coalesce(s.name, o.name, j.name, '256 Newsroom') as publisher_name,
        coalesce(o.slug, s.slug) as publisher_slug, s.homepage_url, o.website_url as platform_website_url,
        coalesce(o.logo_url, j.image_url) as publisher_logo,
        o.id as organization_id, j.id as journalist_id, j.slug as journalist_slug, j.is_independent,
        j.name as journalist_name, j.user_id as journalist_user_id,
        c.name as category_name, c.slug as category_slug,
        d.name as district_name, d.slug as district_slug
      from articles a
      left join sources s on s.id = a.source_id
      left join organizations o on o.id = a.organization_id
      left join journalists j on j.id = a.journalist_id
      left join categories c on c.id = a.category_id
      left join districts d on d.id = a.district_id
      where a.slug = $1 and a.hidden = false and a.status = 'published'
      limit 1
    `, [req.params.slug]);
    const story = rows[0];
    if (!story) return res.status(404).type('html').send('<!doctype html><title>Story not found | 256 Newsroom</title><h1>Story not found</h1><p><a href="/">Return to 256 Newsroom</a></p>');

    // More stories: same journalist first; if none, all journalists under this publisher org.
    const journalistStoriesQuery = story.journalist_id
      ? pool.query(
        `select a.id, a.title, a.slug, a.internal_url, a.image_url, a.published_at, a.summary,
                j.name as journalist_name, j.slug as journalist_slug,
                coalesce(o.name, s.name, '256 Newsroom') as publisher_name
         from articles a
         left join journalists j on j.id = a.journalist_id
         left join organizations o on o.id = a.organization_id
         left join sources s on s.id = a.source_id
         where a.hidden = false and a.status = 'published'
           and a.id <> $1
           and (
             a.journalist_id = $2
             or ($3::bigint is not null and a.created_by_user_id = $3)
           )
           and (a.internal_url is not null or a.slug is not null)
         order by a.published_at desc nulls last
         limit 24`,
        [story.id, story.journalist_id, story.journalist_user_id || story.created_by_user_id || null],
      )
      : story.organization_id
        ? pool.query(
          `select a.id, a.title, a.slug, a.internal_url, a.image_url, a.published_at, a.summary,
                  j.name as journalist_name, j.slug as journalist_slug,
                  coalesce(o.name, s.name, '256 Newsroom') as publisher_name
           from articles a
           left join journalists j on j.id = a.journalist_id
           left join organizations o on o.id = a.organization_id
           left join sources s on s.id = a.source_id
           where a.hidden = false and a.status = 'published'
             and a.id <> $1
             and a.organization_id = $2
             and (
               a.journalist_id is not null
               or a.created_by_user_id in (
                 select user_id from journalists
                 where organization_id = $2 and user_id is not null
               )
             )
             and (a.internal_url is not null or a.slug is not null)
           order by a.published_at desc nulls last
           limit 24`,
          [story.id, story.organization_id],
        )
        : story.created_by_user_id
          ? pool.query(
            `select distinct on (a.id)
                    a.id, a.title, a.slug, a.internal_url, a.image_url, a.published_at, a.summary,
                    coalesce(j.name, j2.name) as journalist_name,
                    coalesce(j.slug, j2.slug) as journalist_slug,
                    coalesce(o.name, s.name, '256 Newsroom') as publisher_name
             from articles a
             left join journalists j on j.id = a.journalist_id
             left join journalists j2 on j2.user_id = a.created_by_user_id
             left join organizations o on o.id = a.organization_id
             left join sources s on s.id = a.source_id
             where a.hidden = false and a.status = 'published'
               and a.id <> $1
               and a.created_by_user_id = $2
               and (a.internal_url is not null or a.slug is not null)
             order by a.id, a.published_at desc nulls last
             limit 24`,
            [story.id, story.created_by_user_id],
          )
          : Promise.resolve({ rows: [] });

    const publisherStatsQuery = story.organization_id
      ? Promise.all([
        pool.query('select count(*)::int as c from publisher_follows where organization_id = $1', [story.organization_id]),
        pool.query('select count(*)::int as c from publisher_likes where organization_id = $1', [story.organization_id]),
        pool.query(
          `select count(*)::int as c from articles
           where organization_id = $1 and status = 'published' and hidden = false`,
          [story.organization_id],
        ),
        pool.query(
          `select verification_status, is_official, tagline, short_path, slug, logo_url
           from organizations where id = $1`,
          [story.organization_id],
        ),
      ]).then(([f, l, a, o]) => ({
        followers: f.rows[0].c,
        likes: l.rows[0].c,
        articles: a.rows[0].c,
        verificationStatus: o.rows[0]?.verification_status,
        isOfficial: o.rows[0]?.is_official,
        tagline: o.rows[0]?.tagline,
        shortPath: o.rows[0]?.short_path,
        orgSlug: o.rows[0]?.slug,
        logoUrl: o.rows[0]?.logo_url,
      }))
      : Promise.resolve(null);

    const [coverageResult, relatedResult, journalistStoriesResult, publisherStats] = await Promise.all([
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
      journalistStoriesQuery,
      publisherStatsQuery,
    ]);

    const summary = String(story.seo_summary || story.summary || '').trim();
    // Breaking-news publishers should not be penalized while they are still the
    // only source covering an event. A validated, independently worded digest is
    // sufficient for indexing; additional publishers enhance the page later.
    // Publisher-authored and independent stories with a real body are first-party
    // content — always treat as full reports on 256 Newsroom.
    const isFirstParty = story.origin === 'publisher_authored' || Boolean(story.body && String(story.body).trim().length > 80);
    const substantive = isFirstParty
      || (story.summary_is_original && wordCount(summary) >= 200 && wordCount(summary) <= 300);
    const internalCanonical = `${SITE}${story.internal_url || (story.slug ? `/news/${story.slug}` : '/')}`;
    const platformCanonical = story.origin === 'ecosystem_ai_generated' && story.platform_website_url && story.slug
      ? `${String(story.platform_website_url).replace(/\/$/, '')}/news/${story.slug}`
      : null;
    const externalOriginal = story.original_url && /^https?:\/\//i.test(String(story.original_url))
      ? String(story.original_url)
      : (story.external_url && /^https?:\/\//i.test(String(story.external_url)) ? String(story.external_url) : null);
    const canonical = platformCanonical || (substantive || isFirstParty ? internalCanonical : (externalOriginal || internalCanonical));
    const description = summary.slice(0, 160) || `${story.title} — report attributed to ${story.publisher_name}.`;
    const imageUrl = story.image_url || null;
    const videoUrl = story.video_url && /^https?:\/\//i.test(String(story.video_url)) ? String(story.video_url) : null;
    const audioUrl = story.audio_url && /^https?:\/\//i.test(String(story.audio_url)) ? String(story.audio_url) : null;
    const soundbiteUrl = story.soundbite_url && /^https?:\/\//i.test(String(story.soundbite_url)) ? String(story.soundbite_url) : null;
    const originalUrl = externalOriginal ? safeUrl(externalOriginal) : null;
    const publisherLogo = story.publisher_logo
      ? `<img src="${safeUrl(story.publisher_logo)}" alt="${escapeHtml(story.publisher_name)} logo">`
      : `<span>${escapeHtml(story.publisher_name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2))}</span>`;
    const videoBlock = videoUrl
      ? (videoUrl.includes('/media/watch/') || videoUrl.includes('/media/file/')
        ? `<div class="story-video"><video controls playsinline preload="metadata" src="${safeUrl(videoUrl.includes('/media/watch/') ? videoUrl.replace('/media/watch/', '/media/file/') : videoUrl)}" style="width:100%;max-height:70vh;background:#000;margin:16px 0;"></video><p><a href="${safeUrl(videoUrl)}" target="_blank" rel="noopener">Open video</a></p></div>`
        : `<p class="story-video-link"><a href="${safeUrl(videoUrl)}" target="_blank" rel="noopener">Watch video →</a></p>`)
      : '';
    const toListenFile = (u) => (u.includes('/media/listen/') || u.includes('/media/watch/')
      ? u.replace('/media/listen/', '/media/file/').replace('/media/watch/', '/media/file/')
      : u);
    const soundbiteBlock = soundbiteUrl
      ? `<div class="story-soundbite" style="background:#111;border:1px solid #333;padding:14px 16px;margin:16px 0;border-radius:4px">
  <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#c99a2e;margin-bottom:6px">Sound bite</div>
  <strong style="display:block;margin-bottom:8px">${escapeHtml(story.soundbite_title || 'Key clip')}</strong>
  <audio controls preload="metadata" src="${safeUrl(toListenFile(soundbiteUrl))}" style="width:100%"></audio>
  <p style="margin:8px 0 0;font-size:.85rem"><a href="${safeUrl(soundbiteUrl)}" target="_blank" rel="noopener">Open sound bite</a></p>
</div>`
      : '';
    const audioBlock = audioUrl
      ? `<div class="story-audio" style="background:#0f0f0f;border:1px solid #333;padding:14px 16px;margin:16px 0;border-radius:4px">
  <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#aaa;margin-bottom:6px">Full audio</div>
  <strong style="display:block;margin-bottom:8px">${escapeHtml(story.audio_title || 'Listen')}</strong>
  <audio controls preload="metadata" src="${safeUrl(toListenFile(audioUrl))}" style="width:100%"></audio>
  <p style="margin:8px 0 0;font-size:.85rem"><a href="${safeUrl(audioUrl)}" target="_blank" rel="noopener">Open audio</a></p>
</div>`
      : '';

    res.set('Cache-Control', 'public, max-age=60');
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
<link rel="stylesheet" href="/story.css?v=20260722-share-sub">
<link rel="stylesheet" href="/engagement.css?v=20260722-share-sub"></head>
<body><header class="site-head"><a href="/" class="brand"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom — Uganda's Digital News Infrastructure"></a></header>
<main class="story-shell"><nav class="crumbs"><a href="/">Home</a> / ${story.category_name ? `<a href="/#${escapeHtml(story.category_slug)}">${escapeHtml(story.category_name)}</a> / ` : ''}<span>${isFirstParty ? 'Story' : 'Story summary'}</span></nav>
<article><div class="story-kicker">${escapeHtml(story.category_name || 'News')}${story.district_name ? ` · ${escapeHtml(story.district_name)}` : ''}</div>
<h1>${escapeHtml(story.title)}</h1>
${story.organization_id && story.publisher_slug ? (() => {
  const badge = publisherStats?.isOfficial
    ? 'Official 256 Update'
    : (publisherStats?.verificationStatus === 'approved' ? 'Verified publisher' : 'Registered publisher');
  const profileHref = publisherStats?.shortPath
    ? `/${escapeHtml(publisherStats.shortPath)}`
    : `/publisher/${escapeHtml(story.publisher_slug)}`;
  return `<div class="pub-card" data-publisher-card data-org-id="${story.organization_id}" data-org-slug="${escapeHtml(story.publisher_slug)}" aria-label="Publisher">
  <div class="pub-card-main">
    <div class="publisher-logo">${publisherLogo}</div>
    <div class="pub-card-text">
      <strong class="pub-card-name"><a class="publisher-name-link" href="${profileHref}">${escapeHtml(story.publisher_name)}</a></strong>
      <p class="pub-card-badge">${escapeHtml(badge)} · <a href="${profileHref}">View profile</a></p>
      ${publisherStats?.tagline ? `<p class="pub-card-tagline">${escapeHtml(publisherStats.tagline)}</p>` : ''}
      <p class="pub-card-meta">${story.author ? `By ${escapeHtml(story.author)} · ` : ''}${escapeHtml(formatDate(story.published_at))}</p>
    </div>
  </div>
  <div class="pub-card-actions">
    <button type="button" class="eng-btn eng-follow" data-action="follow-org" data-org-id="${story.organization_id}">Follow publisher</button>
    <button type="button" class="eng-chip" data-action="like-org" data-org-id="${story.organization_id}">♥ Like <b data-pub-likes>${publisherStats?.likes ?? 0}</b></button>
    <button type="button" class="eng-btn eng-secondary" data-action="subscribe-org" data-org-id="${story.organization_id}">Subscribe to updates</button>
  </div>
  <div class="pub-card-stats">
    <span><b data-pub-followers>${publisherStats?.followers ?? 0}</b> followers</span>
    <span><b data-pub-articles>${publisherStats?.articles ?? 0}</b> articles</span>
    <span><b data-pub-likes-stat>${publisherStats?.likes ?? 0}</b> likes</span>
  </div>
</div>`;
})() : `<div class="publisher story-byline" aria-label="Story attribution">
  <div class="publisher-logo">${publisherLogo}</div>
  <div class="publisher-text">
    <span class="byline-label">Published by</span>
    <strong>${escapeHtml(story.publisher_name)}</strong>
    <span>${story.author ? `By ${escapeHtml(story.author)} · ` : ''}${escapeHtml(formatDate(story.published_at))}</span>
  </div>
</div>`}
${(() => {
  const shareUrl = internalCanonical;
  const shareTitle = story.title;
  const shareText = `${story.title} — via 256 Newsroom`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const mail = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
  const sms = `sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  return `<div class="story-share" data-share-bar data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(shareTitle)}" data-share-text="${escapeHtml(shareText)}">
  <span class="story-share-label">Share</span>
  <div class="story-share-actions">
    <a class="share-btn share-wa" href="${escapeHtml(wa)}" target="_blank" rel="noopener" data-share="whatsapp">WhatsApp</a>
    <a class="share-btn share-mail" href="${escapeHtml(mail)}" data-share="email">Email</a>
    <a class="share-btn share-sms" href="${escapeHtml(sms)}" data-share="sms">Text / SMS</a>
    <button type="button" class="share-btn share-copy" data-share="copy">Copy link</button>
    <button type="button" class="share-btn share-native" data-share="native" hidden>Share…</button>
  </div>
  <p class="share-status" data-share-status hidden></p>
</div>`;
})()}
${imageUrl ? `<figure><img src="${safeUrl(imageUrl)}" alt="${escapeHtml(story.title)}" decoding="async" fetchpriority="high"><figcaption>${escapeHtml(story.image_caption || story.image_credit || `Image · ${story.publisher_name}`)}</figcaption></figure>` : ''}
${soundbiteBlock}
${videoBlock}
${audioBlock}
<section class="summary"><h2>${story.body ? 'Full report' : 'What the report says'}</h2>${story.body ? renderArticleBody(story.body) : renderSummary(summary || 'A substantive summary is not yet available. Use the publisher link below to read the complete report.')}</section>
${originalUrl ? `<a class="original-button" href="${originalUrl}" target="_blank" rel="noopener sponsored">Read the full report at ${escapeHtml(story.publisher_name)} →</a>` : ''}
<div class="eng-panel" data-engagement-article-id="${story.id}" aria-label="Debate this article — agree, disagree, and explain why">
  <p class="eng-note">Loading debate for this article…</p>
</div>
<section><h2>Other publishers covering this story</h2>${renderCoverage(coverageResult.rows)}</section>
<section class="journalist-more-stories">
  <h2>${story.journalist_id && story.journalist_name
    ? `More stories by ${escapeHtml(story.journalist_name)}`
    : story.organization_id
      ? `More stories by journalists at ${escapeHtml(story.publisher_name)}`
      : 'More stories by this journalist'}</h2>
  ${renderJournalistStories(journalistStoriesResult.rows, {
    journalistName: story.journalist_name,
    publisherName: story.publisher_name,
    journalistSlug: story.journalist_slug,
  })}
</section>
<section><h2>Related reporting</h2>${renderRelated(relatedResult.rows)}</section>
</article></main><footer class="story-footer"><a href="/"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom — Uganda's Digital News Infrastructure"></a><p>256 Newsroom aggregates and attributes reporting. Complete articles remain with their original publishers.</p></footer>
<script src="/engagement.js?v=20260722-share-sub" defer></script>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
