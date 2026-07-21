const API = '/api';
const READER_PROFILE_KEY = '256newsroom_reader_profile';
let heroRotationTimer = null;
let heroStories = [];
let heroStoryIndex = 0;
let trendingRotationTimer = null;
let carouselRotationTimer = null;
const storyIndex = new Map();

const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => escapeMap[ch]);
}

function safeHref(value) {
  const str = String(value ?? '').trim();
  if (/^https?:\/\//i.test(str) || str.startsWith('/')) return escapeHtml(str);
  return '#';
}

function sourceInitials(name = '') {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'NR';
}

function sourceTypeLabel(type = '') {
  const labels = {
    local_publisher: 'LOCAL PUBLISHER',
    international_publisher: 'INTERNATIONAL',
    sports_official: 'OFFICIAL SPORTS',
    government_official: 'OFFICIAL GOVERNMENT',
    social_official: 'OFFICIAL SOCIAL',
  };
  return labels[type] || String(type || 'SOURCE').replace(/_/g, ' ').toUpperCase();
}

function sourceBadges(item) {
  const source = item?.source || {};
  const badges = [];
  if (source.official) badges.push('<span class="verify-badge official">OFFICIAL SOURCE</span>');
  if (source.type && source.type !== 'local_publisher') {
    badges.push(`<span class="source-type-badge">${escapeHtml(sourceTypeLabel(source.type))}</span>`);
  }
  return badges.join(' ');
}

function rememberStories(items = []) {
  items.forEach((item) => {
    if (item?.id != null) storyIndex.set(String(item.id), item);
  });
}

function storyAttributes(item) {
  return `class="story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item?.id || '')}" data-category="${escapeHtml(item?.category?.slug || '')}" data-district="${escapeHtml(item?.district?.slug || '')}"`;
}

function setupStoryNavigation() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('.story-clickable, [data-open-story]');
    if (!target?.dataset.storyId) return;
    const item = storyIndex.get(String(target.dataset.storyId));
    if (!item?.internalUrl) return;
    event.preventDefault();
    window.location.href = item.internalUrl;
  });
  document.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest('.story-clickable');
    if (!target?.dataset.storyId) return;
    const item = storyIndex.get(String(target.dataset.storyId));
    if (!item?.internalUrl) return;
    event.preventDefault();
    window.location.href = item.internalUrl;
  });
}

function setupSearch() {
  const form = document.getElementById('site-search-form');
  const input = document.getElementById('site-search-input');
  const results = document.getElementById('site-search-results');
  if (!form || !input || !results) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (q.length < 2) return;
    results.hidden = false;
    results.innerHTML = '<p>Searching…</p>';
    try {
      const data = await getJson(`/search?q=${encodeURIComponent(q)}`);
      const people = (data.journalists || []).map((j) => `<a class="search-person" href="${safeHref(j.profile_url)}"><b>${escapeHtml(j.name)}</b><span>${escapeHtml(j.beat || 'Journalist')}</span></a>`).join('');
      const stories = (data.stories || []).map((s) => `<a class="search-story" href="${safeHref(s.internalUrl)}"><b>${escapeHtml(s.title)}</b><span>${escapeHtml(s.source?.name || '')} · ${escapeHtml(s.category?.name || 'News')}</span></a>`).join('');
      results.innerHTML = `${people ? `<h3>Journalists</h3>${people}` : ''}${stories ? `<h3>News</h3>${stories}` : ''}${!people && !stories ? '<p>No matching news or journalists found.</p>' : ''}`;
    } catch (_) { results.innerHTML = '<p>Search is temporarily unavailable.</p>'; }
  });
  const initialQuery = new URLSearchParams(window.location.search).get('search');
  if (initialQuery) {
    input.value = initialQuery;
    window.requestAnimationFrame(() => form.requestSubmit());
  }
}

function imageClass(item) {
  return item.district?.slug || item.category?.slug || 'trade';
}

function imageStyle(item) {
  const raw = String(item?.imageUrl ?? '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  const cssSafe = raw.replace(/\\/g, '%5C').replace(/'/g, '%27').replace(/"/g, '&quot;');
  return ` style="background-image:linear-gradient(180deg, rgba(13,15,12,0) 45%, rgba(13,15,12,0.45) 100%), url('${cssSafe}'); background-size:cover; background-position:center;"`;
}

const imagePreloadCache = new Map();

function preloadImage(url, timeoutMs = 4000) {
  const src = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(src)) return Promise.resolve();
  if (imagePreloadCache.has(src)) return imagePreloadCache.get(src);

  const request = new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
      } catch (_) {
        // A loaded image is still usable when decode() is unsupported or rejects.
      }
      finish();
    };
    img.onerror = finish;
    img.src = src;
  });

  imagePreloadCache.set(src, request);
  return request;
}

function preloadArticleImages(items = []) {
  const urls = [...new Set(items.map((item) => item?.imageUrl).filter(Boolean))];
  return Promise.all(urls.map((url) => preloadImage(url)));
}

function readReaderProfile() {
  try {
    return JSON.parse(localStorage.getItem(READER_PROFILE_KEY)) || { categories: {}, districts: {}, terms: [] };
  } catch (_) {
    return { categories: {}, districts: {}, terms: [] };
  }
}

function saveReaderInterest(item) {
  const profile = readReaderProfile();
  profile.categories ||= {};
  profile.districts ||= {};
  if (item?.category?.slug) profile.categories[item.category.slug] = (profile.categories[item.category.slug] || 0) + 1;
  if (item?.district?.slug) profile.districts[item.district.slug] = (profile.districts[item.district.slug] || 0) + 2;
  localStorage.setItem(READER_PROFILE_KEY, JSON.stringify(profile));
}

function personalizeItems(items = [], profile = readReaderProfile()) {
  return items.map((item, index) => {
    const categoryScore = Number(profile.categories?.[item.category?.slug] || 0) * 3;
    const districtScore = Number(profile.districts?.[item.district?.slug] || 0) * 5;
    const locationScore = profile.locationDistrict && item.district?.slug === profile.locationDistrict ? 100 : 0;
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    const termScore = (profile.terms || []).reduce((score, term) => score + (text.includes(String(term).toLowerCase()) ? 4 : 0), 0);
    return { item, index, score: categoryScore + districtScore + locationScore + termScore };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(({ item }) => item);
}

function setupInterestTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-story-id]');
    if (!link) return;
    saveReaderInterest({
      category: link.dataset.category ? { slug: link.dataset.category } : null,
      district: link.dataset.district ? { slug: link.dataset.district } : null,
    });
  });
}

const districtCentres = [
  ['kampala', 0.3476, 32.5825], ['wakiso', 0.4044, 32.4594], ['mukono', 0.3533, 32.7553],
  ['jinja', 0.4479, 33.2026], ['mbale', 1.0806, 34.1750], ['gulu', 2.7724, 32.2881],
  ['mbarara', -0.6072, 30.6545], ['fort-portal', 0.6710, 30.2750], ['masaka', -0.3338, 31.7341],
  ['arua', 3.0303, 30.9107], ['lira', 2.2499, 32.8998], ['soroti', 1.7146, 33.6111],
  ['kabale', -1.2417, 29.9856], ['hoima', 1.4331, 31.3524], ['moroto', 2.5345, 34.6666],
];

function nearestDistrict(latitude, longitude) {
  return districtCentres.reduce((nearest, district) => {
    const distance = ((latitude - district[1]) ** 2) + ((longitude - district[2]) ** 2);
    return !nearest || distance < nearest.distance ? { slug: district[0], distance } : nearest;
  }, null)?.slug || null;
}

function resolveReaderProfile() {
  const profile = readReaderProfile();
  if (profile.locationDistrict || !navigator.geolocation) return Promise.resolve(profile);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      profile.locationDistrict = nearestDistrict(coords.latitude, coords.longitude);
      localStorage.setItem(READER_PROFILE_KEY, JSON.stringify(profile));
      resolve(profile);
    }, () => resolve(profile), { enableHighAccuracy: false, timeout: 3000, maximumAge: 86400000 });
  });
}

function rotatedWindow(items = [], start = 0, size = 4) {
  if (!items.length) return [];
  return Array.from({ length: Math.min(size, items.length) }, (_, index) => items[(start + index) % items.length]);
}

function formatTime(value) {
  if (!value) return 'recently';
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.round(diffMs / 36e5));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
}

async function safeJson(path) {
  try { return await getJson(path); } catch (error) {
    console.warn(`Live data unavailable for ${path}:`, error.message);
    return { items: [] };
  }
}

function initializeLiveMounts() {
  const skeleton = (className, count) => Array.from({ length: count }, () => `<article class="${className} loading-card" aria-label="Loading current live coverage"><div class="loading-media"></div><div class="loading-line wide"></div><div class="loading-line"></div></article>`).join('');
  document.querySelectorAll('#panel-home .trending-row.in-column').forEach((mount) => { mount.innerHTML = skeleton('cluster-card', 4); });
  document.querySelectorAll('#panel-home .card-grid').forEach((mount) => { mount.innerHTML = skeleton('grid-card', 6); });
  document.querySelectorAll('#panel-home .story-list').forEach((mount) => { mount.innerHTML = skeleton('story-card', 2); });
  document.querySelectorAll('#panel-home .social-scroll').forEach((mount) => { mount.innerHTML = skeleton('social-card', 6); });
  document.querySelectorAll('#panel-home .district-scroll').forEach((mount) => { mount.innerHTML = skeleton('district-card', 6); });
  document.querySelectorAll('#panel-home .journalist-scroll').forEach((mount) => { mount.innerHTML = skeleton('journalist-card', 4); });
  document.querySelectorAll('#panel-home .district-feature-list').forEach((mount) => { mount.innerHTML = skeleton('district-feature-loading', 4); });
  const citizen = document.querySelector('.citizens-scroll');
  if (citizen) citizen.innerHTML = '<label for="citizen-modal-toggle" class="citizen-submit-card"><span>+</span><b>Share a verified news tip</b></label><article class="empty-card"><h3>Loading current community coverage…</h3></article>';
  const ecosystem = document.querySelector('.eco-teaser-box');
  if (ecosystem) ecosystem.innerHTML = '<div class="sidebar-title">256 AI Systems</div><p class="eco-empty">Loading verified platform information…</p>';
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.querySelector('.hero-headline').textContent = 'Loading the current top story…';
    hero.querySelector('.hero-excerpt').textContent = 'Fetching the latest verified coverage from monitored sources.';
    hero.querySelector('.hero-img')?.removeAttribute('style');
  }
}

function setMastheadDate() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function setMastheadStatus(sourceCount) {
  const statusEl = document.getElementById('masthead-status');
  if (statusEl) statusEl.innerHTML = `<span class="live-pulse"></span><strong>Uganda's News, As It Happens</strong><small>${sourceCount} trusted sources monitored live</small>`;
}

function setTicker(items) {
  const mount = document.querySelector('.ticker');
  if (!mount) return;
  if (!items?.length) {
    mount.innerHTML = '<span>No breaking headlines right now.</span>';
    return;
  }
  mount.innerHTML = items.slice(0, 6).map((item, index) => `
    <a href="${safeHref(item.internalUrl)}" ${storyAttributes(item)}>${index === 0 ? '<b>BREAKING -</b> ' : ''}${escapeHtml(item.title)}</a>
  `).join('');
}

function setTopSources(items) {
  const mount = document.querySelector('.top-sources');
  if (!mount || !items?.length) return;
  mount.innerHTML = '<span class="ts-label">Top Sources Today</span>' + items.map((source, index) => `
    <div class="ts-item">
      <span class="ts-rank">${index + 1}</span>
      <span class="ts-chip">${escapeHtml(sourceInitials(source.name))}</span>
      <span class="ts-name">${escapeHtml(source.name)}</span>
      <span class="ts-stat">${Number(source.article_count || 0)} stories</span>
    </div>
  `).join('');
}

function articleCard(item) {
  const initials = sourceInitials(item.source?.name);
  return `
    <article class="grid-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <div class="thumb ${imageClass(item)}"${imageStyle(item)}></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${sourceBadges(item)} <span class="source-chip"><span class="dot-mark np">${escapeHtml(initials)}</span>${escapeHtml(item.source?.name || '256 Newsroom')}</span> · ${formatTime(item.publishedAt)}</p>
      <a href="${safeHref(item.internalUrl)}" class="read-link" data-open-story data-story-id="${escapeHtml(item.id)}">Read summary</a>
    </article>
  `;
}

function setHero(item) {
  if (!item) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const title = hero.querySelector('.hero-headline');
  const excerpt = hero.querySelector('.hero-excerpt');
  const image = hero.querySelector('.hero-img');
  const cap = hero.querySelector('.hero-img span');
  const meta = hero.querySelector('.story-meta');
  const eyebrow = hero.querySelector('.eyebrow');
  hero.classList.add('story-clickable');
  hero.setAttribute('role', 'link');
  hero.setAttribute('tabindex', '0');
  hero.dataset.storyId = item.id;
  hero.dataset.category = item.category?.slug || '';
  hero.dataset.district = item.district?.slug || '';
  if (eyebrow) eyebrow.innerHTML = `<span class="dot"></span>Hot &amp; Trending · ${escapeHtml(item.district?.name || (item.category?.slug === 'world' ? 'World' : 'Uganda'))}`;
  if (title) title.innerHTML = `<a href="${safeHref(item.internalUrl)}" data-open-story data-story-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`;
  if (excerpt) excerpt.innerHTML = `<a href="${safeHref(item.internalUrl)}" data-open-story data-story-id="${escapeHtml(item.id)}">${escapeHtml(item.summary || 'Latest developing story from monitored Ugandan news sources.')}</a>`;
  if (image && item.imageUrl) image.setAttribute('style', imageStyle(item).replace(/^ style="/, '').replace(/"$/, ''));
  if (image && !item.imageUrl) image.removeAttribute('style');
  if (cap) cap.textContent = `${item.source?.name || '256 Newsroom'} · ${formatTime(item.publishedAt)}`;
  if (meta) {
    meta.innerHTML = `
      ${sourceBadges(item)}
      <span class="source-chip"><span class="dot-mark np">${escapeHtml(sourceInitials(item.source?.name))}</span>${escapeHtml(item.source?.name || '256 Newsroom')}</span>
      <span class="cluster-note">${item.source?.official ? 'Direct official source' : 'Live from approved source feed'}</span>
      <a href="${safeHref(item.internalUrl)}" class="read-link" data-open-story data-story-id="${escapeHtml(item.id)}">Read summary</a>
    `;
  }
  const position = hero.querySelector('.hero-position');
  if (position && heroStories.length) position.textContent = `${heroStoryIndex + 1} / ${heroStories.length}`;
}

function scheduleHeroRotation() {
  if (heroRotationTimer) clearTimeout(heroRotationTimer);
  if (heroStories.length < 2) return;
  heroRotationTimer = setTimeout(() => showHeroStory(heroStoryIndex + 1), 12000);
}

function showHeroStory(index) {
  if (!heroStories.length) return;
  heroStoryIndex = (index + heroStories.length) % heroStories.length;
  setHero(heroStories[heroStoryIndex]);
  scheduleHeroRotation();
}

function startHeroRotation(items = []) {
  heroStories = items.filter(Boolean);
  heroStoryIndex = 0;
  if (heroRotationTimer) clearTimeout(heroRotationTimer);
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const move = (direction, event) => { event?.preventDefault(); event?.stopPropagation(); showHeroStory(heroStoryIndex + direction); };
  hero.querySelector('.hero-prev')?.addEventListener('click', (event) => move(-1, event));
  hero.querySelector('.hero-next')?.addEventListener('click', (event) => move(1, event));
  let touchStartX = null;
  hero.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
  hero.addEventListener('touchend', (event) => {
    if (touchStartX == null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(distance) >= 50) move(distance > 0 ? -1 : 1, event);
  });
  setHero(heroStories[0]);
  scheduleHeroRotation();
}

function setCardGrid(heading, items) {
  const sections = [...document.querySelectorAll('#panel-home section')];
  const section = sections.find((candidate) => candidate.querySelector('.section-header h2')?.textContent.trim() === heading);
  const mount = section?.querySelector('.card-grid');
  if (!mount) return;
  mount.innerHTML = items?.length
    ? items.slice(0, 6).map(articleCard).join('')
    : '<article class="grid-card empty-card"><h3>No current stories in this category yet</h3><p>Waiting for approved source feeds.</p></article>';
}

function setTrending(items) {
  const mount = document.querySelector('.trending-row.in-column');
  if (!mount || !items?.length) return;
  mount.innerHTML = items.slice(0, 4).map((item) => `
    <article class="cluster-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <div class="trend-thumb ${imageClass(item)}"${imageStyle(item)}></div>
      <span class="cat-tag">${escapeHtml(item.category?.name || 'News')}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="cmeta">${sourceBadges(item)}<span>${escapeHtml(item.source?.name || '256 Newsroom')}</span></div>
      <div class="trend-tag">updated ${formatTime(item.publishedAt)}</div>
      <a href="${safeHref(item.internalUrl)}" class="read-link" data-open-story data-story-id="${escapeHtml(item.id)}">Read summary</a>
    </article>
  `).join('');
}

function startTrendingRotation(items = []) {
  const stories = items.filter(Boolean);
  if (trendingRotationTimer) clearInterval(trendingRotationTimer);
  if (stories.length <= 4) return;
  let index = 0;
  trendingRotationTimer = setInterval(() => {
    index = (index + 4) % stories.length;
    setTrending(rotatedWindow(stories, index, 4));
  }, 60000);
}

function startCarouselRotation() {
  if (carouselRotationTimer) clearInterval(carouselRotationTimer);
  const selectors = ['.card-grid', '.eco-grid', '.social-scroll', '.citizens-scroll', '.district-scroll', '.journalist-scroll'];
  carouselRotationTimer = setInterval(() => {
    document.querySelectorAll(selectors.join(',')).forEach((mount) => {
      if (mount.scrollWidth <= mount.clientWidth + 4) return;
      const first = mount.firstElementChild;
      const gap = Number.parseFloat(getComputedStyle(mount).columnGap || getComputedStyle(mount).gap || '0') || 0;
      const step = first ? first.getBoundingClientRect().width + gap : mount.clientWidth;
      const nearEnd = mount.scrollLeft + mount.clientWidth + step >= mount.scrollWidth;
      mount.scrollTo({ left: nearEnd ? 0 : mount.scrollLeft + step, behavior: 'smooth' });
    });
  }, 60000);
}

function platformLogo(item) {
  if (item?.logoUrl) return item.logoUrl;
  const key = String(item?.platform || '').toLowerCase().replace(/\s+/g, '');
  const logos = {
    '256heart': '/assets/logos/256-heart.png',
    '256corporate': '/assets/logos/256-corporate.png',
    '256mall': '/assets/logos/256-mall.png',
    '256express': '/assets/logos/256-express.png',
    '256shield': '/assets/logos/256-shield.svg',
    '256ai': '/assets/logos/256-ai.png',
    '256linkshield': '/assets/logos/256-linkshield.svg',
  };
  return logos[key] || '';
}

// Sidebar always lists all 7 official 256 platforms (owned content, clearly labeled as such).
// The grid below it prefers real independent coverage crawled from other outlets, and only
// falls back to the official platform list - still labeled OFFICIAL - when none exists yet.
function domainFromLink(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function setEcosystem(items) {
  const mount = document.querySelector('.eco-teaser-box');
  if (!mount) return;
  const directory = [
    { platform:'256 AI', description:'AI infrastructure and automation', link:'https://ai.256.co.ug' },
    { platform:'256 Mall', description:'Commerce and verified marketplace services', link:'https://256mall.com' },
    { platform:'256 Express', description:'Transport, delivery and logistics', link:'https://256express.com' },
    { platform:'256 Heart', description:'Dating and matchmaking platform', link:'https://256heart.com' },
    { platform:'256 Corporate', description:'Business, talent and technology services', link:'https://enterprise.256.co.ug' },
    { platform:'256Shield', description:'Cybersecurity and digital protection', link:'https://shield.256.co.ug' },
    { platform:'256LinkShield', description:'Link and website reputation checking', link:'https://linkshield.256.co.ug' },
  ];
  const platforms = directory.map((entry) => ({ ...entry, ...(items || []).find((item) => item.platform === entry.platform) }));
  mount.innerHTML = '<div class="sidebar-title">256 AI Systems Ecosystem</div>' + platforms.slice(0, 7).map((item) => `
    <a class="eco-teaser-item" href="${safeHref(item.articleUrl || item.link) !== '#' ? safeHref(item.articleUrl || item.link) : '/#ecosystem'}"${item.articleUrl ? '' : ' target="_blank" rel="noopener"'}>
      <div class="side-thumb">${platformLogo(item) ? `<img src="${safeHref(platformLogo(item))}" alt="${escapeHtml(item.platform)} logo">` : `<span>${escapeHtml(item.mark || item.platform[0])}</span>`}</div>
      <div><b>${escapeHtml(item.platform)}</b>${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ''}<p>${escapeHtml(item.title ? (item.summary || 'Read the latest official platform update.') : (item.description || item.summary))}</p><span class="eco-domain">${item.publishedAt ? `Published ${formatTime(item.publishedAt)} · Read summary` : escapeHtml(domainFromLink(item.link))}</span></div>
    </a>
  `).join('') + '<a href="/#ecosystem" data-tab-link="ecosystem" class="eco-teaser-more">EXPLORE THE COMPLETE ECOSYSTEM →</a>';
}

function setEcosystemGrid(items, officialItems = []) {
  const sections = [...document.querySelectorAll('#panel-home section')];
  const section = sections.find((candidate) => candidate.querySelector('.section-header h2')?.textContent.trim() === 'Latest from 256 AI Systems');
  const mount = section?.querySelector('.eco-grid');
  if (!mount) return;
  if (items?.length) {
    mount.innerHTML = items.slice(0, 6).map((item) => `
    <article class="eco-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <a class="eco-card-media" href="${safeHref(item.internalUrl)}">
        <div class="eco-card-thumb ${imageClass(item)}"${imageStyle(item)}><span>${escapeHtml(item.source?.name || 'Live News')}</span></div>
      </a>
      <div>
        <small>256 AI Systems <b>${item.source?.official ? 'OFFICIAL SOURCE' : 'PUBLISHED COVERAGE'}</b></small>
        <h3><a href="${safeHref(item.internalUrl)}">${escapeHtml(item.title)}</a></h3>
        <p><a href="${safeHref(item.internalUrl)}">${escapeHtml(item.summary || 'Published coverage mentioning 256 AI Systems.')}</a></p>
        <footer><span>${formatTime(item.publishedAt)}</span><a href="${safeHref(item.internalUrl)}">Read Summary -></a></footer>
      </div>
    </article>
  `).join('');
    return;
  }
  if (!officialItems?.length) { section.hidden = true; return; }
  mount.innerHTML = (officialItems || []).slice(0, 6).map((item) => {
    const siteLink = item.link ? safeHref(item.link) : '/#ecosystem';
    return `
    <article class="eco-card">
      <a class="eco-card-media" href="${siteLink}" target="_blank" rel="noopener">
        <div class="eco-card-thumb ${String(item.platform || '').toLowerCase().replace(/\s+/g, '')}">
          ${platformLogo(item) ? `<img src="${safeHref(platformLogo(item))}" alt="${escapeHtml(item.platform)} logo">` : `<span>${escapeHtml(item.platform || '256')}</span>`}
        </div>
      </a>
      <div>
        <small>${escapeHtml(item.type || 'Platform Update')} <b>OFFICIAL 256 UPDATE</b></small>
        <h3><a href="${siteLink}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
        <p><a href="${siteLink}" target="_blank" rel="noopener">${escapeHtml(item.summary)}</a></p>
        <footer>
          ${item.profileUrl ? `<a href="${safeHref(item.profileUrl)}">Press Coverage -></a>` : '<span>Official update</span>'}
          <a href="${siteLink}" target="_blank" rel="noopener">Visit ${escapeHtml(item.platform || 'Site')} -></a>
        </footer>
      </div>
    </article>
  `;
  }).join('');
}

function setSocialLatest(items) {
  const mount = document.querySelector('.social-scroll');
  if (!mount) return;
  if (!items?.length) { mount.innerHTML = '<article class="empty-card"><h3>No current updates available.</h3></article>'; return; }
  mount.innerHTML = items.slice(0, 6).map((item) => `
    <article class="social-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <div class="social-thumb ${imageClass(item)}"${imageStyle(item)}><span>${escapeHtml(item.source?.name || 'Live News')}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${sourceBadges(item)} ${escapeHtml(item.category?.name || 'News')} · ${formatTime(item.publishedAt)}</p>
      <b><a href="${safeHref(item.internalUrl)}" data-open-story data-story-id="${escapeHtml(item.id)}">Read summary</a></b>
    </article>
  `).join('');
}

function setCitizenLatest(items) {
  const mount = document.querySelector('.citizens-scroll');
  if (!mount) return;
  if (!items?.length) { mount.innerHTML = '<label for="citizen-modal-toggle" class="citizen-submit-card"><span>+</span><b>Share a verified news tip</b></label><article class="empty-card"><h3>No current community coverage available.</h3></article>'; return; }
  mount.innerHTML = `
    <label for="citizen-modal-toggle" class="citizen-submit-card"><span>+</span><b>Share what's happening near you</b></label>
    ${items.slice(0, 5).map((item) => `
      <article class="citizen-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
        <div class="citizen-thumb ${imageClass(item)}"${imageStyle(item)}><span>LIVE NEWS</span></div>
        <h3><a href="${safeHref(item.internalUrl)}">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.source?.name || '256 Newsroom')} · ${escapeHtml(item.district?.name || item.category?.name || 'Uganda')} · ${formatTime(item.publishedAt)}</p>
      </article>
    `).join('')}
  `;
}

function setJournalists(items) {
  const mount = document.querySelector('.journalist-scroll');
  if (!mount) return;
  const profiles = items || [];
  if (!profiles.length) {
    mount.innerHTML = '<a class="journalist-card featured" href="/dashboard/login.html"><span class="journalist-photo"><span>+</span></span><h3>Create your journalist profile</h3><p>Independent journalists and newsroom teams</p><b>Join 256 Newsroom →</b></a><a class="journalist-card" href="/journalists/"><span class="journalist-photo"><span>⌕</span></span><h3>Journalist directory</h3><p>Search by name, beat or location</p><b>Find journalists →</b></a>';
    return;
  }
  mount.innerHTML = profiles.slice(0, 6).map((item, index) => `
    <a href="${safeHref(item.profile_url || '#')}" class="journalist-card ${index === 0 ? 'featured' : ''}">
      <span class="journalist-photo jp-${index + 1}"${item.image_url ? imageStyle({ imageUrl: item.image_url }) : ''}><span>${escapeHtml(sourceInitials(item.name))}</span></span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.beat || 'Journalist')}</p>
      <b>${Number(item.published_story_count || 0).toLocaleString()} published stories</b>
    </a>
  `).join('');
}

function setDistricts(items) {
  const mount = document.querySelector('.district-scroll');
  const sidebar = document.querySelector('.district-feature-list');
  if (!items?.length) {
    if (mount) mount.innerHTML = '<article class="district-card empty-card"><h3>No current district-tagged stories</h3><p>The live feed has not supplied reliable district metadata yet.</p></article>';
    if (sidebar) sidebar.innerHTML = '<article class="empty-card"><h3>No current district-tagged stories</h3><p>Checking live source feeds.</p></article>';
    return;
  }
  if (mount) mount.innerHTML = items.slice(0, 6).map((item) => `
    <article class="district-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <div class="district-card-thumb ${imageClass(item)}"${imageStyle(item)}><span>${escapeHtml(item.district?.name || 'UGANDA')}</span></div>
      <h3><a href="${safeHref(item.internalUrl)}">${escapeHtml(item.title)}</a></h3>
      <p>${sourceBadges(item)} <span class="source-chip"><span class="dot-mark np">${escapeHtml(sourceInitials(item.source?.name))}</span>${escapeHtml(item.source?.name || '256 Newsroom')}</span></p>
    </article>
  `).join('');
  if (sidebar) sidebar.innerHTML = items.slice(0, 4).map((item) => `
    <article class="story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <div class="district-feature-thumb ${imageClass(item)}"${imageStyle(item)}></div>
      <span>${escapeHtml(item.district?.name || 'UGANDA')}</span>
      <h3><a href="${safeHref(item.internalUrl)}" data-open-story data-story-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</a></h3>
      <p>${escapeHtml(item.source?.name || '256 Newsroom')} · ${formatTime(item.publishedAt)}</p>
    </article>
  `).join('');
}

function setDeveloping(items = []) {
  const mount = document.querySelector('.story-list');
  if (!mount) return;
  if (!items.length) {
    mount.innerHTML = '<article class="story-card empty-card"><div><h3>No developing stories currently available</h3><p>The live feed will update this section when new reports arrive.</p></div></article>';
    return;
  }
  mount.innerHTML = items.slice(0, 4).map((item) => `
    <article class="story-card story-clickable" role="link" tabindex="0" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}">
      <div class="story-thumb ${imageClass(item)}"${imageStyle(item)}></div><div>
        <h3><a href="${safeHref(item.internalUrl)}" data-open-story data-story-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</a></h3>
        <p><span class="verify-badge developing">LATEST</span> ${escapeHtml(item.source?.name || '256 Newsroom')} · ${formatTime(item.publishedAt)}</p>
      </div>
    </article>
  `).join('');
}

function setCategoryTab(slug, items) {
  const mount = document.querySelector(`.card-grid[data-category="${slug}"]`);
  if (!mount) return;
  mount.innerHTML = items?.length
    ? items.slice(0, 12).map(articleCard).join('')
    : '<article class="grid-card empty-card"><h3>No current stories in this category yet</h3><p>Waiting for approved source feeds.</p></article>';
}

async function setCategoryTabs(districtItems = []) {
  const categoryMap = {
    uganda: '/news/category/national?limit=12',
    politics: '/news/category/politics?limit=12',
    business: '/news/category/business?limit=12',
    sports: '/news/category/sports?limit=12',
    world: '/news/category/world?limit=12',
  };

  await Promise.all(Object.entries(categoryMap).map(async ([slug, path]) => {
    try {
      const data = await getJson(path);
      await preloadArticleImages(data.items || []);
      rememberStories(data.items || []);
      setCategoryTab(slug, data.items || []);
    } catch (err) {
      setCategoryTab(slug, []);
    }
  }));
  setCategoryTab('district', districtItems || []);
}

function setupCitizenReportForm() {
  const submitBtn = document.getElementById('citizen-report-submit');
  const textarea = document.getElementById('citizen-report-text');
  const districtSelect = document.getElementById('citizen-report-district');
  const anonymousCheckbox = document.getElementById('citizen-report-anonymous');
  const status = document.getElementById('citizen-report-status');
  const modalToggle = document.getElementById('citizen-modal-toggle');
  if (!submitBtn || !textarea) return;

  submitBtn.addEventListener('click', async () => {
    const description = textarea.value.trim();
    if (status) { status.textContent = ''; status.classList.remove('is-error'); }
    if (!description) {
      if (status) { status.textContent = 'Please describe what you are seeing.'; status.classList.add('is-error'); }
      return;
    }
    submitBtn.disabled = true;
    try {
      const response = await fetch('/api/citizen-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          districtSlug: districtSelect?.value || null,
          anonymous: Boolean(anonymousCheckbox?.checked),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${response.status}`);
      }
      textarea.value = '';
      if (districtSelect) districtSelect.value = '';
      if (anonymousCheckbox) anonymousCheckbox.checked = false;
      if (status) { status.textContent = 'Thanks - your report was submitted for moderation.'; status.classList.remove('is-error'); }
      setTimeout(() => {
        if (modalToggle) modalToggle.checked = false;
        if (status) status.textContent = '';
      }, 1600);
    } catch (err) {
      if (status) { status.textContent = 'Could not submit your report. Please try again.'; status.classList.add('is-error'); }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function bootLiveNews() {
  initializeLiveMounts();
  setupSearch();
  setupCitizenReportForm();
  setupInterestTracking();
  setupStoryNavigation();
  setMastheadDate();
  try {
    const [hero, top, latest, national, world, sports, districtNews, ecosystemNews, sources, ecosystem, journalists, readerProfile] = await Promise.all([
      safeJson('/news/hero?limit=12'),
      safeJson('/news/top?limit=12'),
      safeJson('/news/latest?limit=12'),
      safeJson('/news/category/national?limit=6'),
      safeJson('/news/category/world?limit=6'),
      safeJson('/news/category/sports?limit=6'),
      safeJson('/news/districts/latest?limit=12'),
      safeJson('/news/ecosystem?limit=6'),
      safeJson('/news/sources/top?limit=50'),
      safeJson('/ecosystem'),
      safeJson('/journalists/top?limit=6'),
      resolveReaderProfile(),
    ]);
    const heroStories = personalizeItems(hero.items || [], readerProfile);
    const topStories = personalizeItems(top.items || [], readerProfile);
    const latestStories = personalizeItems(latest.items || [], readerProfile);
    const districtStories = personalizeItems(districtNews.items || [], readerProfile);
    rememberStories([
      ...heroStories,
      ...topStories,
      ...latestStories,
      ...(national.items || []),
      ...(world.items || []),
      ...(sports.items || []),
      ...districtStories,
      ...(ecosystemNews.items || []),
    ]);

    // Warm every image used by the initial live view before replacing the
    // matching article text. Because the cards use CSS background images,
    // preloading here ensures the browser already has the image when the text
    // and card markup are revealed. Missing image URLs keep their fallback.
    await preloadArticleImages([
      ...heroStories,
      ...topStories,
      ...latestStories,
      ...(national.items || []),
      ...(world.items || []),
      ...(sports.items || []),
      ...districtStories,
      ...(ecosystemNews.items || []),
    ]);

    setTicker(topStories);
    setMastheadStatus((sources.items || []).length);
    setTrending(rotatedWindow(topStories, 0, 4));
    startTrendingRotation(topStories);
    setHero(heroStories[0]);
    startHeroRotation(heroStories);
    setCardGrid('National Headlines', national.items || []);
    setCardGrid('International News', world.items || []);
    setCardGrid('Sports News', sports.items || []);
    setDistricts(districtStories);
    setEcosystemGrid(ecosystemNews.items || [], ecosystem.items || []);
    setSocialLatest(latestStories);
    setCitizenLatest(latestStories);
    setDeveloping(latestStories);
    setTopSources((sources.items || []).slice(0, 9));
    setEcosystem(ecosystem.items || []);
    setJournalists(journalists.items);
    await setCategoryTabs(districtStories);
    startCarouselRotation();
  } catch (err) {
    const statusEl = document.getElementById('masthead-status');
    if (statusEl) statusEl.innerHTML = '<strong>Uganda\'s Newsroom</strong><small>Refreshing the latest coverage…</small>';
    console.warn('Live news unavailable:', err.message);
  }
}

bootLiveNews();
