import { api } from './api.js';
import { loadContext } from './context.js';
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
import * as verification from './sections/verification.js';
import * as rssDistribution from './sections/rssDistribution.js';
import * as settings from './sections/settings.js';
import * as journalistProfile from './sections/journalistProfile.js';

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

const ADMIN_NAV = {
  section: 'Ecosystem Automation',
  items: [
    { path: '/admin/ecosystem/overview', label: 'Overview' },
    { path: '/admin/ecosystem/platforms', label: 'Platforms' },
    { path: '/admin/ecosystem/articles', label: 'Generated Articles' },
    { path: '/admin/ecosystem/jobs', label: 'Jobs & Audit Log' },
  ],
};

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
  { pattern: /^\/settings$/, render: (m, c) => settings.render(contentEl, c) },
  { pattern: /^\/journalist-profile$/, render: () => journalistProfile.render(contentEl) },
  { pattern: /^\/admin\/ecosystem\/overview$/, render: (m, c) => adminOverview.render(contentEl, c) },
  { pattern: /^\/admin\/ecosystem\/platforms$/, render: (m, c) => adminPlatforms.render(contentEl, c) },
  { pattern: /^\/admin\/ecosystem\/platforms\/(\d+)$/, render: (m, c) => adminPlatformDetail.render(contentEl, c, { orgId: m[1] }) },
  { pattern: /^\/admin\/ecosystem\/articles$/, render: (m, c, q) => adminArticles.render(contentEl, c, { status: q.status }) },
  { pattern: /^\/admin\/ecosystem\/jobs$/, render: (m, c, q) => adminJobs.render(contentEl, c, { status: q.status }) },
];

function navConfigFor(mode) {
  if (mode === 'org') return ORG_NAV;
  if (mode === 'independent') return INDEPENDENT_NAV;
  return ONBOARDING_NAV;
}

function renderNav(mode, currentPath) {
  const groups = navConfigFor(mode).slice();
  if (ctx.isGlobalAdmin) groups.push(ADMIN_NAV);
  navEl.innerHTML = '';
  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'dash-nav-section';
    heading.textContent = group.section;
    navEl.appendChild(heading);
    for (const item of group.items) {
      const a = document.createElement('a');
      a.href = `#${item.path}`;
      a.textContent = item.label;
      const isPlatformDetail = item.path === '/admin/ecosystem/platforms' && currentPath.startsWith('/admin/ecosystem/platforms/');
      if (item.path === currentPath || isPlatformDetail || (item.path === '/stories' && currentPath.startsWith('/stories/') && currentPath !== '/stories/new' && currentPath !== '/stories/scheduled')) {
        a.classList.add('active');
      }
      navEl.appendChild(a);
    }
  }
}

function renderTopbar() {
  if (ctx.organization) {
    const statusLabel = ctx.organization.is_official ? 'Official 256 Update' : ctx.organization.verification_status.replace(/_/g, ' ');
    const statusClass = ctx.organization.verification_status === 'approved' ? 'badge-green' : 'badge-gold';
    topbarOrgEl.innerHTML = `${escapeHtml(ctx.organization.name)} <span class="badge ${statusClass}" style="margin-left:8px;">${escapeHtml(statusLabel)}</span>`;
  } else if (ctx.isIndependentJournalist) {
    topbarOrgEl.textContent = 'Independent Journalist';
  } else {
    topbarOrgEl.textContent = 'Get started';
  }
  topbarUserEl.textContent = ctx.user.displayName || ctx.user.email;
}

async function route() {
  const raw = window.location.hash.replace('#', '') || '/overview';
  const [path, search] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(search || ''));

  if (ctx.mode === 'onboarding' && path !== '/settings' && !(ctx.isGlobalAdmin && path.startsWith('/admin/'))) {
    renderNav('onboarding', '/overview');
    contentEl.innerHTML = '';
    contentEl.appendChild(await onboarding.render(contentEl, ctx));
    return;
  }

  renderNav(ctx.mode, path);
  const match = ROUTES.find((r) => r.pattern.test(path));
  if (!match) {
    contentEl.innerHTML = '<p class="dash-empty">Page not found.</p>';
    return;
  }
  contentEl.innerHTML = '<p class="dash-empty">Loading…</p>';
  try {
    await match.render(path.match(match.pattern), ctx, query);
  } catch (err) {
    contentEl.innerHTML = `<div class="dash-toast error">${escapeHtml(err.message || 'Something went wrong.')}</div>`;
  }
}

async function boot() {
  try {
    ctx = await loadContext();
  } catch {
    window.location.href = '/dashboard/login.html';
    return;
  }
  if (!ctx.user) {
    window.location.href = `/dashboard/login.html?next=${encodeURIComponent('/dashboard/' + window.location.hash)}`;
    return;
  }

  renderTopbar();
  document.getElementById('dash-logout').addEventListener('click', async () => {
    await api.post('/auth/logout');
    window.location.href = '/dashboard/login.html';
  });

  window.addEventListener('hashchange', route);
  await route();
}

boot();
