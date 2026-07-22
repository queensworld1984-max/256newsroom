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
        return `<a class="pub-story lux-story" href="${href}">
          ${s.image_url ? `<img src="${safeUrl(s.image_url)}" alt="" loading="lazy">` : '<div class="pub-story-ph"></div>'}
          <div class="lux-story-body">
            <small>${escapeHtml(formatDate(s.published_at))}</small>
            <strong>${escapeHtml(s.title)}</strong>
            <p>${escapeHtml(String(s.summary || '').slice(0, 160))}</p>
            <span class="pub-story-engage">Read full report →</span>
          </div>
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
<link rel="stylesheet" href="/story.css?v=20260722-lux-profile">
<link rel="stylesheet" href="/engagement.css?v=20260722-lux-profile">
</head>
<body class="publisher-page lux-profile">
<header class="site-head"><a href="/" class="brand"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a></header>
<main class="publisher-shell lux-shell" data-publisher-org-id="${org.id}" data-publisher-slug="${escapeHtml(org.slug)}" data-publisher-profile="1">
  <nav class="crumbs lux-crumbs"><a href="/">Home</a> <span aria-hidden="true">·</span> <span>Publisher house</span></nav>

  <section class="lux-hero">
    <div class="lux-hero-glow" aria-hidden="true"></div>
    <div class="lux-hero-inner">
      <div class="lux-identity">
        <div class="lux-logo-ring">
          <div class="publisher-logo large lux-logo">${logo}</div>
        </div>
        <div class="lux-identity-text">
          <p class="lux-badge"><span class="lux-badge-dot"></span>${escapeHtml(badge)}</p>
          <h1 class="lux-name">${escapeHtml(org.name)}</h1>
          ${org.tagline ? `<p class="lux-tagline">${escapeHtml(org.tagline)}</p>` : '<p class="lux-tagline lux-tagline-soft">Trusted publishing on 256 Newsroom</p>'}
          <p class="lux-meta">
            <span>${escapeHtml((org.org_type || 'publisher').replace(/_/g, ' '))}</span>
            ${org.headquarters ? `<span class="lux-meta-sep">·</span><span>${escapeHtml(org.headquarters)}</span>` : ''}
            ${org.founded_year ? `<span class="lux-meta-sep">·</span><span>Est. ${Number(org.founded_year)}</span>` : ''}
            ${org.years_in_journalism ? `<span class="lux-meta-sep">·</span><span>${Number(org.years_in_journalism)} years in journalism</span>` : ''}
          </p>
        </div>
      </div>

      <div class="lux-stats" aria-label="Publisher statistics">
        <article class="lux-stat lux-stat-followers">
          <div class="lux-stat-icon" aria-hidden="true">◈</div>
          <strong data-follower-count>${followers}</strong>
          <span>Followers</span>
          <em>Community reach</em>
        </article>
        <article class="lux-stat lux-stat-likes">
          <div class="lux-stat-icon" aria-hidden="true">♥</div>
          <strong data-pub-likes>${likes}</strong>
          <span>Likes</span>
          <em>Reader admiration</em>
        </article>
        <article class="lux-stat lux-stat-pubs">
          <div class="lux-stat-icon" aria-hidden="true">▣</div>
          <strong data-pub-articles>${articles}</strong>
          <span>Publications</span>
          <em>Stories on record</em>
        </article>
        <article class="lux-stat lux-stat-subs">
          <div class="lux-stat-icon" aria-hidden="true">✉</div>
          <strong data-pub-subscribers>${subscribers}</strong>
          <span>Subscribers</span>
          <em>News update list</em>
        </article>
      </div>

      <div class="lux-actions publisher-actions" id="publisher-actions">
        <button type="button" class="lux-btn lux-btn-primary eng-follow" data-action="follow-org" data-org-id="${org.id}">Follow publisher</button>
        <button type="button" class="lux-btn lux-btn-like" data-action="like-org" data-org-id="${org.id}">♥ Like <b data-pub-likes-btn>${likes}</b></button>
        <button type="button" class="lux-btn lux-btn-sub" data-action="subscribe-org" data-org-id="${org.id}">Subscribe to updates</button>
        ${org.website_url ? `<a class="lux-btn lux-btn-ghost" href="${safeUrl(org.website_url)}" target="_blank" rel="noopener">Website</a>` : ''}
        <a class="lux-btn lux-btn-ghost" href="/dashboard/login.html?next=${encodeURIComponent(`/publisher/${org.slug}`)}">Sign in</a>
      </div>
      <div class="pub-subscribe-box lux-subscribe" data-subscribe-box data-org-id="${org.id}" hidden>
        <p class="eng-note">Receive articles, press releases and exclusive updates from this house.</p>
        <form class="pub-subscribe-form" data-subscribe-form>
          <input type="email" name="email" placeholder="Your email" required maxlength="200">
          <input type="text" name="displayName" placeholder="Name (optional)" maxlength="200">
          <button type="submit" class="lux-btn lux-btn-primary">Confirm subscription</button>
        </form>
        <p class="eng-note" data-subscribe-status></p>
      </div>
    </div>
  </section>

  <div class="lux-body story-shell">
    <section class="lux-panel pub-section">
      <div class="lux-panel-head"><span class="lux-kicker">House brief</span><h2>About</h2></div>
      ${bio ? `<div class="publisher-desc pub-bio">${escapeHtml(bio).replace(/\n/g, '<br>')}</div>` : '<p class="empty-note">No biography yet.</p>'}
    </section>

    <section class="lux-panel pub-section">
      <div class="lux-panel-head"><span class="lux-kicker">Expertise</span><h2>Areas of practice</h2></div>
      ${areasHtml}
    </section>

    <section class="lux-panel pub-section">
      <div class="lux-panel-head"><span class="lux-kicker">Career</span><h2>Work &amp; experience</h2></div>
      <p class="eng-note">Newsroom roles and professional milestones.</p>
      ${workHtml}
    </section>

    <section class="lux-panel pub-section">
      <div class="lux-panel-head"><span class="lux-kicker">Newsroom</span><h2>Journalists</h2></div>
      ${journosHtml}
    </section>

    <section class="lux-panel pub-section">
      <div class="lux-panel-head"><span class="lux-kicker">Archive</span><h2>Publications</h2></div>
      <p class="eng-note">${articles} published ${articles === 1 ? 'story' : 'stories'} on 256 Newsroom.</p>
      <div class="pub-story-list lux-story-list">${storyCards}</div>
    </section>
  </div>
</main>
<footer class="story-footer"><a href="/"><img src="/assets/logos/256-newsroom.png" alt="256 Newsroom"></a><p>Registered publishers on 256 Newsroom.</p></footer>
<script src="/engagement.js?v=20260722-lux-profile" defer></script>
</body></html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
