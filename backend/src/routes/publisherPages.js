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

function yearRange(start, end, isCurrent) {
  if (!start && !end) return '';
  const a = start || '?';
  const b = isCurrent ? 'Present' : (end || '?');
  return `${a} – ${b}`;
}

// GET /publisher/:slug — full public publisher profile (LinkedIn-style)
router.get('/publisher/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id, name, slug, short_path, org_type, description, biography, logo_url, website_url,
              verification_status, is_official, active, tagline, headquarters,
              areas_of_practice, years_in_journalism, founded_year, created_at
       from organizations where slug = $1 or lower(short_path) = lower($1)`,
      [req.params.slug],
    );
    const org = rows[0];
    if (!org || !org.active) {
      return res.status(404).type('html').send('<!doctype html><title>Publisher not found</title><h1>Publisher not found</h1><p><a href="/">256 Newsroom</a></p>');
    }

    const [
      { rows: followerRows },
      { rows: likeRows },
      { rows: articleCountRows },
      { rows: subscriberRows },
      { rows: stories },
      { rows: work },
      { rows: journalists },
    ] = await Promise.all([
      pool.query('select count(*)::int as c from publisher_follows where organization_id = $1', [org.id]),
      pool.query('select count(*)::int as c from publisher_likes where organization_id = $1', [org.id]),
      pool.query(
        `select count(*)::int as c from articles
         where organization_id = $1 and status = 'published' and hidden = false`,
        [org.id],
      ),
      pool.query(
        'select count(*)::int as c from publisher_subscribers where organization_id = $1 and active = true',
        [org.id],
      ),
      pool.query(
        `select id, title, summary, slug, internal_url, image_url, published_at
         from articles
         where organization_id = $1 and status = 'published' and hidden = false
         order by published_at desc nulls last
         limit 40`,
        [org.id],
      ),
      pool.query(
        `select id, title, organization_name, location, start_year, end_year, is_current, description
         from publisher_work_profiles
         where organization_id = $1
         order by is_current desc, sort_order asc, start_year desc nulls last, id desc`,
        [org.id],
      ),
      pool.query(
        `select id, name, slug, bio, image_url, years_in_journalism, areas_of_practice, tagline
         from journalists where organization_id = $1 order by name limit 40`,
        [org.id],
      ),
    ]);

    const followers = followerRows[0].c;
    const likes = likeRows[0].c;
    const articles = articleCountRows[0].c;
    const subscribers = subscriberRows[0].c;
    const badge = org.is_official
      ? 'Official 256 Update'
      : (org.verification_status === 'approved' ? 'Verified publisher' : 'Registered publisher');
    const logo = org.logo_url
      ? `<img src="${safeUrl(org.logo_url)}" alt="">`
      : `<span>${escapeHtml(org.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;
    const bio = org.biography || org.description || '';
    const areas = Array.isArray(org.areas_of_practice) ? org.areas_of_practice : [];

    const storyCards = stories.length
      ? stories.map((s) => {
        const href = escapeHtml(s.internal_url || (s.slug ? `/news/${s.slug}` : '#'));
        return `<a class="pub-story" href="${href}">
          ${s.image_url ? `<img src="${safeUrl(s.image_url)}" alt="" loading="lazy">` : '<div class="pub-story-ph"></div>'}
          <div><strong>${escapeHtml(s.title)}</strong>
          <small>${escapeHtml(formatDate(s.published_at))}</small>
          <p>${escapeHtml(String(s.summary || '').slice(0, 160))}</p>
          <span class="pub-story-engage">Open article to debate</span></div>
        </a>`;
      }).join('')
      : '<p class="empty-note">No published stories yet.</p>';

    const workHtml = work.length
      ? `<ol class="work-timeline">${work.map((w) => `
        <li class="work-item">
          <div class="work-years">${escapeHtml(yearRange(w.start_year, w.end_year, w.is_current))}${w.is_current ? ' · Current' : ''}</div>
          <strong>${escapeHtml(w.title)}</strong>
          <div class="work-org">${escapeHtml(w.organization_name)}${w.location ? ` · ${escapeHtml(w.location)}` : ''}</div>
          ${w.description ? `<p>${escapeHtml(w.description)}</p>` : ''}
        </li>`).join('')}</ol>`
      : '<p class="empty-note">No work history added yet.</p>';

    const areasHtml = areas.length
      ? `<ul class="practice-tags">${areas.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
      : '<p class="empty-note">Areas of practice not listed yet.</p>';

    const journosHtml = journalists.length
      ? `<div class="pub-journalists">${journalists.map((j) => {
        const href = j.slug ? `/journalists/profile.html?slug=${encodeURIComponent(j.slug)}` : '#';
        const img = j.image_url
          ? `<img src="${safeUrl(j.image_url)}" alt="">`
          : `<span>${escapeHtml((j.name || '?').slice(0, 1))}</span>`;
        return `<a class="pub-journalist" href="${escapeHtml(href)}">
          <div class="pub-journalist-avatar">${img}</div>
          <div>
            <strong>${escapeHtml(j.name)}</strong>
            ${j.tagline ? `<small>${escapeHtml(j.tagline)}</small>` : ''}
            ${j.years_in_journalism ? `<small>${Number(j.years_in_journalism)} years in journalism</small>` : ''}
          </div>
        </a>`;
      }).join('')}</div>`
      : '<p class="empty-note">No linked journalists yet.</p>';

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(org.name)} · Publisher · 256 Newsroom</title>
<meta name="description" content="${escapeHtml(bio || org.tagline || `${org.name} on 256 Newsroom`)}">
<link rel="stylesheet" href="/story.css?v=20260722-share-sub">
<link rel="stylesheet" href="/engagement.css?v=20260722-share-sub">
</head>
<body class="publisher-page">
<header class="site-head"><a href="/" class="brand"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a></header>
<main class="story-shell publisher-shell" data-publisher-org-id="${org.id}" data-publisher-slug="${escapeHtml(org.slug)}" data-publisher-profile="1">
  <nav class="crumbs"><a href="/">Home</a> / <span>Publisher profile</span></nav>

  <header class="publisher-hero pub-profile-hero">
    <div class="publisher-logo large">${logo}</div>
    <div class="publisher-hero-text">
      <p class="story-kicker">${escapeHtml(badge)}</p>
      <h1>${escapeHtml(org.name)}</h1>
      ${org.tagline ? `<p class="publisher-tagline">${escapeHtml(org.tagline)}</p>` : ''}
      <p class="publisher-meta">
        ${(org.org_type || '').replace(/_/g, ' ')}
        ${org.headquarters ? ` · ${escapeHtml(org.headquarters)}` : ''}
        ${org.founded_year ? ` · Est. ${Number(org.founded_year)}` : ''}
        ${org.years_in_journalism ? ` · ${Number(org.years_in_journalism)} years in journalism` : ''}
      </p>

      <div class="pub-stats-grid" aria-label="Publisher statistics">
        <div class="pub-stat"><strong data-follower-count>${followers}</strong><span>Followers</span></div>
        <div class="pub-stat"><strong data-pub-likes>${likes}</strong><span>Likes</span></div>
        <div class="pub-stat"><strong data-pub-articles>${articles}</strong><span>Publications</span></div>
        <div class="pub-stat"><strong data-pub-subscribers>${subscribers}</strong><span>Subscribers</span></div>
      </div>

      <div class="publisher-actions" id="publisher-actions">
        <button type="button" class="eng-btn eng-follow" data-action="follow-org" data-org-id="${org.id}">Follow publisher</button>
        <button type="button" class="eng-chip" data-action="like-org" data-org-id="${org.id}">♥ Like publisher <b data-pub-likes-btn>${likes}</b></button>
        <button type="button" class="eng-btn eng-secondary" data-action="subscribe-org" data-org-id="${org.id}">Subscribe to news updates</button>
        ${org.website_url ? `<a class="eng-btn eng-secondary" href="${safeUrl(org.website_url)}" target="_blank" rel="noopener">Website</a>` : ''}
        <a class="eng-btn eng-secondary" href="/dashboard/login.html?next=${encodeURIComponent(`/publisher/${org.slug}`)}">Sign in to engage</a>
      </div>
      <div class="pub-subscribe-box" data-subscribe-box data-org-id="${org.id}" hidden>
        <p class="eng-note">Get articles, press releases and updates from this publisher.</p>
        <form class="pub-subscribe-form" data-subscribe-form>
          <input type="email" name="email" placeholder="Your email" required maxlength="200">
          <input type="text" name="displayName" placeholder="Name (optional)" maxlength="200">
          <button type="submit" class="eng-btn">Confirm subscription</button>
        </form>
        <p class="eng-note" data-subscribe-status></p>
      </div>
      <p class="eng-note">Follow, like, or subscribe to updates. Debate (agree / disagree) is on each article page.</p>
    </div>
  </header>

  <section class="pub-section">
    <h2>About</h2>
    ${bio ? `<div class="publisher-desc pub-bio">${escapeHtml(bio).replace(/\n/g, '<br>')}</div>` : '<p class="empty-note">No biography yet.</p>'}
  </section>

  <section class="pub-section">
    <h2>Areas of practice</h2>
    ${areasHtml}
  </section>

  <section class="pub-section">
    <h2>Work &amp; experience</h2>
    <p class="eng-note">Career and newsroom roles (LinkedIn-style).</p>
    ${workHtml}
  </section>

  <section class="pub-section">
    <h2>Journalists</h2>
    ${journosHtml}
  </section>

  <section class="pub-section">
    <h2>Publications</h2>
    <p class="eng-note">${articles} published stories on 256 Newsroom.</p>
    <div class="pub-story-list">${storyCards}</div>
  </section>
</main>
<footer class="story-footer"><a href="/"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a><p>Registered publishers on 256 Newsroom.</p></footer>
<script src="/engagement.js?v=20260722-share-sub" defer></script>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
