import { api } from './api.js';
import { loadContext, setWorkspace } from './context.js';
import { escapeHtml } from './util.js';

import * as onboarding from './sections/onboarding.js';
import * as overview from './sections/overview.js';
import * as stories from './sections/stories.js';
import * as storyForm from './sections/storyForm.js';
import * as externalRss from './sections/externalRss.js';
import * as journalists from './sections/journalists.js';
import * as media from './sections/media.js';
import * as taxonomy from './sections/taxonomy.js';
import * as corrections from './sections/corrections.js';
import * as analytics from './sections/analytics.js';
import * as orgProfile from './sections/orgProfile.js';
import * as subscribers from './sections/subscribers.js';
import * as verification from './sections/verification.js';
import * as rssDistribution from './sections/rssDistribution.js';
import * as settings from './sections/settings.js';
import * as journalistProfile from './sections/journalistProfile.js';
import { mountNotifications } from './notifications.js';

import * as adminCommandCenter from './sections/admin/commandCenter.js';
import * as adminPeople from './sections/admin/people.js';
import * as adminApplications from './sections/admin/applications.js';
import * as adminModerationStories from './sections/admin/moderationStories.js';
import * as adminOverview from './sections/admin/overview.js';
import * as adminPlatforms from './sections/admin/platforms.js';
import * as adminPlatformDetail from './sections/admin/platformDetail.js';
import * as adminArticles from './sections/admin/articles.js';
import * as adminJobs from './sections/admin/jobs.js';

const navEl = document.getElementById('dash-nav');
const contentEl = document.getElementById('dash-content');
const topbarOrgEl = document.getElementById('dash-topbar-org');
const topbarUserEl = document.getElementById('dash-topbar-user');

let ctx = null;
let routing = false;
let listenersBound = false;

const ORG_NAV = [
  { section: 'Newsroom', items: [
    { path: '/overview', label: 'Overview' },
    { path: '/stories', label: 'Stories' },
    { path: '/stories/new', label: 'Create Story' },
    { path: '/stories/scheduled', label: 'Scheduled Stories' },
    { path: '/corrections', label: 'Corrections' },
  ] },
  { section: 'Distribution', items: [
    { path: '/external-rss', label: 'External RSS' },
    { path: '/rss-distribution', label: 'RSS Distribution' },
    { path: '/subscribers', label: 'Subscribers & updates' },
  ] },
  { section: 'Organization', items: [
    { path: '/journalists', label: 'Journalists' },
    { path: '/media', label: 'Media Library' },
    { path: '/taxonomy', label: 'Categories & Districts' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/profile', label: 'Organization Profile' },
    { path: '/verification', label: 'Verification' },
    { path: '/settings', label: 'Settings' },
  ] },
];

const INDEPENDENT_NAV = [
  { section: 'Newsroom', items: [
    { path: '/overview', label: 'Overview' },
    { path: '/stories', label: 'My Stories' },
    { path: '/stories/new', label: 'Create Story' },
    { path: '/stories/scheduled', label: 'Scheduled Stories' },
    { path: '/media', label: 'Media Library' },
  ] },
  { section: 'Account', items: [
    { path: '/journalist-profile', label: 'My Public Profile' },
    { path: '/taxonomy', label: 'Categories & Districts' },
    { path: '/settings', label: 'Settings' },
  ] },
];

const ONBOARDING_NAV = [
  { section: 'Get started', items: [{ path: '/overview', label: 'Overview' }] },
];

const ADMIN_NAV_GROUPS = [
  { section: 'Control room', items: [
    { path: '/admin', label: 'Command center' },
    { path: '/admin/people', label: 'People & accounts' },
    { path: '/admin/applications', label: 'Publisher applications' },
    { path: '/admin/stories', label: 'Story queue' },
  ] },
  { section: 'Ecosystem automation', items: [
    { path: '/admin/ecosystem/overview', label: 'Automation overview' },
    { path: '/admin/ecosystem/platforms', label: 'Platforms' },
    { path: '/admin/ecosystem/articles', label: 'Generated articles' },
    { path: '/admin/ecosystem/jobs', label: 'Jobs & audit log' },
  ] },
];

const ROUTES = [
  { pattern: /^\/overview$/, render: (m, c) => overview.render(contentEl, c) },
  { pattern: /^\/stories$/, render: (m, c, q) => stories.render(contentEl, c, { status: q.status }) },
  { pattern: /^\/stories\/scheduled$/, render: (m, c) => stories.render(contentEl, c, { status: 'scheduled' }) },
  { pattern: /^\/stories\/new$/, render: (m, c) => storyForm.render(contentEl, c, { id: null }) },
  { pattern: /^\/stories\/(\d+)\/edit$/, render: (m, c) => storyForm.render(contentEl, c, { id: m[1] }) },
  { pattern: /^\/external-rss$/, render: (m, c) => externalRss.render(contentEl, c) },
  { pattern: /^\/journalists$/, render: (m, c) => journalists.render(contentEl, c) },
  { pattern: /^\/media$/, render: (m, c) => media.render(contentEl, c) },
  { pattern: /^\/taxonomy$/, render: (m, c) => taxonomy.render(contentEl, c) },
  { pattern: /^\/corrections$/, render: (m, c) => corrections.render(contentEl, c) },
  { pattern: /^\/analytics$/, render: (m, c) => analytics.render(contentEl, c) },
  { pattern: /^\/profile$/, render: (m, c) => orgProfile.render(contentEl, c) },
  { pattern: /^\/verification$/, render: (m, c) => verification.render(contentEl, c) },
  { pattern: /^\/rss-distribution$/, render: (m, c) => rssDistribution.render(contentEl, c) },
  { pattern: /^\/subscribers$/, render: (m, c) => subscribers.render(contentEl, c) },
  { pattern: /^\/settings$/, render: (m, c) => settings.render(contentEl, c) },
  { pattern: /^\/journalist-profile$/, render: () => journalistProfile.render(contentEl) },
  { pattern: /^\/admin\/?$/, render: () => adminCommandCenter.render(contentEl) },
  { pattern: /^\/admin\/people\/?$/, render: (m, c) => adminPeople.render(contentEl, c) },
  { pattern: /^\/admin\/applications\/?$/, render: () => adminApplications.render(contentEl) },
  { pattern: /^\/admin\/stories\/?$/, render: (m, c, q) => adminModerationStories.render(contentEl, c, q) },
  { pattern: /^\/admin\/ecosystem\/overview$/, render: (m, c) => adminOverview.render(contentEl, c) },
  { pattern: /^\/admin\/ecosystem\/platforms$/, render: (m, c) => adminPlatforms.render(contentEl, c) },
  { pattern: /^\/admin\/ecosystem\/platforms\/(\d+)$/, render: (m, c) => adminPlatformDetail.render(contentEl, c, { orgId: m[1] }) },
  { pattern: /^\/admin\/ecosystem\/articles$/, render: (m, c, q) => adminArticles.render(contentEl, c, { status: q.status }) },
  { pattern: /^\/admin\/ecosystem\/jobs$/, render: (m, c, q) => adminJobs.render(contentEl, c, { status: q.status }) },
];

function navConfigFor(mode) {
  if (mode === 'admin') return ADMIN_NAV_GROUPS;
  if (mode === 'org') return ORG_NAV;
  if (mode === 'independent') return INDEPENDENT_NAV;
  return ONBOARDING_NAV;
}

function currentPathFromHash() {
  const rawHash = window.location.hash || '';
  // Support #/admin, #admin, #/admin?x=1
  let raw = rawHash.replace(/^#/, '');
  if (!raw.startsWith('/')) raw = `/${raw}`;
  if (raw === '/') raw = '';
  const [pathPart, search = ''] = raw.split('?');
  let path = pathPart || (ctx?.mode === 'admin' ? '/admin' : '/overview');
  // Normalize trailing slash except root-like
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  const query = Object.fromEntries(new URLSearchParams(search));
  return { path, query };
}

function renderNav(mode, currentPath) {
  const groups = navConfigFor(mode).map((g) => ({ section: g.section, items: g.items.slice() }));

  if (ctx.isGlobalAdmin && mode === 'admin') {
    const switchers = [];
    if (ctx.hasOrgWorkspace) switchers.push({ path: '/__workspace/org', label: '-> My outlet workspace' });
    if (ctx.isIndependentJournalist) switchers.push({ path: '/__workspace/independent', label: '-> My journalist workspace' });
    if (switchers.length) groups.push({ section: 'Personal workspaces', items: switchers });
  } else if (ctx.isGlobalAdmin && mode !== 'admin') {
    groups.push({
      section: 'Platform admin',
      items: [{ path: '/__workspace/admin', label: '<- Back to control room' }],
    });
  }

  navEl.innerHTML = '';
  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'dash-nav-section';
    heading.textContent = group.section;
    navEl.appendChild(heading);
    for (const item of group.items) {
      const a = document.createElement('a');
      a.href = item.path.startsWith('/__workspace') ? '#' : `#${item.path}`;
      a.textContent = item.label;
      if (item.path.startsWith('/__workspace')) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const ws = item.path.split('/').pop();
          setWorkspace(ws === 'admin' ? 'admin' : ws);
          window.location.hash = ws === 'admin' ? '#/admin' : '#/overview';
          boot();
        });
      }
      const isPlatformDetail = item.path === '/admin/ecosystem/platforms' && currentPath.startsWith('/admin/ecosystem/platforms/');
      const isAdminHome = (item.path === '/admin' && (currentPath === '/admin' || currentPath === '/admin/'));
      if (
        item.path === currentPath
        || isPlatformDetail
        || isAdminHome
        || (item.path === '/stories' && currentPath.startsWith('/stories/') && currentPath !== '/stories/new' && currentPath !== '/stories/scheduled')
        || (item.path === '/admin/stories' && currentPath.startsWith('/admin/stories'))
      ) {
        a.classList.add('active');
      }
      navEl.appendChild(a);
    }
  }
}

function renderTopbar() {
  const roleEl = document.getElementById('dash-sidebar-role');
  if (ctx.mode === 'admin') {
    topbarOrgEl.innerHTML = '<span class="admin-topbar-title">Platform control room</span> <span class="badge badge-gold" style="margin-left:8px;">Admin</span>';
    if (roleEl) roleEl.textContent = 'Platform admin';
  } else if (ctx.organization) {
    const statusLabel = ctx.organization.is_official ? 'Official 256 Update' : String(ctx.organization.verification_status || 'unverified').replace(/_/g, ' ');
    const statusClass = ctx.organization.verification_status === 'approved' ? 'badge-green' : 'badge-gold';
    topbarOrgEl.innerHTML = `${escapeHtml(ctx.organization.name)} <span class="badge ${statusClass}" style="margin-left:8px;">${escapeHtml(statusLabel)}</span>`;
    if (roleEl) roleEl.textContent = 'Publisher outlet';
  } else if (ctx.isIndependentJournalist) {
    topbarOrgEl.textContent = 'Independent Journalist';
    if (roleEl) roleEl.textContent = 'Independent journalist';
  } else {
    topbarOrgEl.textContent = 'Get started';
    if (roleEl) roleEl.textContent = 'Onboarding';
  }
  topbarUserEl.textContent = ctx.user.displayName || ctx.user.email;
  document.body.classList.toggle('is-admin-mode', ctx.mode === 'admin');
  document.title = ctx.mode === 'admin' ? '256 Newsroom — Platform Admin' : '256 Newsroom — Dashboard';
  mountNotifications(topbarUserEl);
}

async function route() {
  if (!ctx?.user) return;
  if (routing) return;
  routing = true;
  try {
    let { path, query } = currentPathFromHash();

    // Admins landing on generic overview go to control room — without aborting render.
    if (ctx.mode === 'admin' && (path === '/overview' || path === '' || path === '/')) {
      path = '/admin';
      if (window.location.hash !== '#/admin') {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/admin`);
      }
    }

    if (ctx.mode === 'onboarding' && path !== '/settings' && !(ctx.isGlobalAdmin && path.startsWith('/admin'))) {
      renderNav('onboarding', '/overview');
      contentEl.innerHTML = '';
      contentEl.appendChild(await onboarding.render(contentEl, ctx));
      return;
    }

    if (path.startsWith('/admin') && !ctx.isGlobalAdmin) {
      contentEl.innerHTML = '<div class="dash-toast error">Admin access required.</div>';
      return;
    }

    renderNav(ctx.mode, path);
    const match = ROUTES.find((r) => r.pattern.test(path));
    if (!match) {
      contentEl.innerHTML = `<p class="dash-empty">Page not found: ${escapeHtml(path)}</p>`;
      return;
    }

    // Leave a short loading marker; page modules may replace immediately.
    contentEl.innerHTML = '<p class="dash-empty">Loading…</p>';
    await match.render(path.match(match.pattern), ctx, query);

    // If a module forgot to paint, do not leave the spinner forever.
    if (contentEl.textContent.trim() === 'Loading…') {
      contentEl.innerHTML = '<div class="dash-toast error">This page did not finish rendering. Try a hard refresh (Ctrl+F5).</div>';
    }
  } catch (err) {
    console.error('Dashboard route error', err);
    contentEl.innerHTML = `<div class="dash-toast error">${escapeHtml(err?.message || 'Something went wrong loading this page.')}</div>`;
  } finally {
    routing = false;
  }
}

async function boot() {
  try {
    contentEl.innerHTML = '<p class="dash-empty">Starting dashboard…</p>';
    ctx = await loadContext();
  } catch (err) {
    console.error('loadContext failed', err);
    contentEl.innerHTML = `<div class="dash-toast error">Could not load your session (${escapeHtml(err?.message || 'error')}). <a href="/dashboard/login.html">Sign in again</a>.</div>`;
    return;
  }

  if (!ctx.user) {
    window.location.href = `/dashboard/login.html?next=${encodeURIComponent('/dashboard/' + (window.location.hash || '#/admin'))}`;
    return;
  }

  if (ctx.mode === 'admin' && (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/overview')) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/admin`);
  }

  renderTopbar();

  if (!listenersBound) {
    listenersBound = true;
    document.getElementById('dash-logout').addEventListener('click', async () => {
      try { await api.post('/auth/logout'); } catch { /* ignore */ }
      sessionStorage.removeItem('nr_workspace');
      window.location.href = '/dashboard/login.html';
    });
    window.addEventListener('hashchange', () => { route(); });
  }

  await route();
}

boot().catch((err) => {
  console.error('boot failed', err);
  contentEl.innerHTML = `<div class="dash-toast error">Dashboard failed to start: ${escapeHtml(err?.message || String(err))}</div>`;
});
