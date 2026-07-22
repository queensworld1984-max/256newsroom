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

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-UG', {
    dateStyle: 'medium', timeZone: 'Africa/Kampala',
  }).format(new Date(value));
}

// GET /publisher/:slug — public HTML profile for registered organizations
router.get('/publisher/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id, name, slug, org_type, description, logo_url, website_url,
              verification_status, is_official, active
       from organizations where slug = $1`,
      [req.params.slug],
    );
    const org = rows[0];
    if (!org || !org.active) {
      return res.status(404).type('html').send('<!doctype html><title>Publisher not found</title><h1>Publisher not found</h1><p><a href="/">256 Newsroom</a></p>');
    }

    const [{ rows: followerRows }, { rows: stories }] = await Promise.all([
      pool.query('select count(*)::int as c from publisher_follows where organization_id = $1', [org.id]),
      pool.query(
        `select id, title, summary, slug, internal_url, image_url, published_at
         from articles
         where organization_id = $1 and status = 'published' and hidden = false
         order by published_at desc nulls last
         limit 40`,
        [org.id],
      ),
    ]);

    const badge = org.is_official
      ? 'Official 256 Update'
      : (org.verification_status === 'approved' ? 'Verified publisher' : 'Registered publisher');
    const logo = org.logo_url
      ? `<img src="${safeUrl(org.logo_url)}" alt="">`
      : `<span>${escapeHtml(org.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;

    const storyCards = stories.length
      ? stories.map((s) => {
        const href = escapeHtml(s.internal_url || (s.slug ? `/news/${s.slug}` : '#'));
        return `<a class="pub-story" href="${href}">
          ${s.image_url ? `<img src="${safeUrl(s.image_url)}" alt="" loading="lazy">` : '<div class="pub-story-ph"></div>'}
          <div><strong>${escapeHtml(s.title)}</strong>
          <small>${escapeHtml(formatDate(s.published_at))}</small>
          <p>${escapeHtml(String(s.summary || '').slice(0, 160))}</p>
          <span class="pub-story-engage">Open article to debate (agree / disagree + why)</span></div>
        </a>`;
      }).join('')
      : '<p class="empty-note">No published stories yet.</p>';

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(org.name)} · Publisher · 256 Newsroom</title>
<meta name="description" content="${escapeHtml(org.description || `${org.name} on 256 Newsroom`)}">
<link rel="stylesheet" href="/story.css?v=20260722-article-eng">
<link rel="stylesheet" href="/engagement.css?v=20260722-article-eng">
</head>
<body class="publisher-page">
<header class="site-head"><a href="/" class="brand"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a></header>
<main class="story-shell publisher-shell" data-publisher-org-id="${org.id}" data-publisher-slug="${escapeHtml(org.slug)}">
  <nav class="crumbs"><a href="/">Home</a> / <span>Publisher</span></nav>
  <header class="publisher-hero">
    <div class="publisher-logo large">${logo}</div>
    <div class="publisher-hero-text">
      <p class="story-kicker">${escapeHtml(badge)}</p>
      <h1>${escapeHtml(org.name)}</h1>
      <p class="publisher-meta"><span data-follower-count>${followerRows[0].c}</span> followers · ${(org.org_type || '').replace(/_/g, ' ')}</p>
      ${org.description ? `<p class="publisher-desc">${escapeHtml(org.description)}</p>` : ''}
      <div class="publisher-actions" id="publisher-actions">
        <button type="button" class="eng-btn eng-follow" data-action="follow-org" data-org-id="${org.id}">Follow publisher</button>
        ${org.website_url ? `<a class="eng-btn eng-secondary" href="${safeUrl(org.website_url)}" target="_blank" rel="noopener">Website</a>` : ''}
        <a class="eng-btn eng-secondary" href="/dashboard/login.html?next=${encodeURIComponent(`/publisher/${org.slug}`)}">Journalist / publisher login</a>
      </div>
      <p class="eng-note">You can follow this publisher here. Debate (agree / disagree with reasons) lives on each article page — not on this profile.</p>
    </div>
  </header>
  <section>
    <h2>Stories from this publisher</h2>
    <p class="eng-note">Open a story to agree or disagree with a written reason. Debate is per article only.</p>
    <div class="pub-story-list">${storyCards}</div>
  </section>
</main>
<footer class="story-footer"><a href="/"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a><p>Registered publishers on 256 Newsroom.</p></footer>
<script src="/engagement.js?v=20260722-article-eng" defer></script>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
