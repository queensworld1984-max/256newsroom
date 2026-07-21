const API = '/api';
const READER_PROFILE_KEY = '256newsroom_reader_profile';
let heroRotationTimer = null;
let trendingRotationTimer = null;
let carouselRotationTimer = null;

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

function setMastheadDate() {
  const dateEl = document.getElementById('masthead-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function setMastheadStatus(sourceCount) {
  const statusEl = document.getElementById('masthead-status');
  if (statusEl) statusEl.textContent = `${sourceCount} sources monitored · live`;
}

function setTicker(items) {
  const mount = document.querySelector('.ticker');
  if (!mount) return;
  if (!items?.length) {
    mount.innerHTML = '<span>No breaking headlines right now.</span>';
    return;
  }
  mount.innerHTML = items.slice(0, 6).map((item, index) => `
    <span>${index === 0 ? '<b>BREAKING -</b> ' : ''}${escapeHtml(item.title)}</span>
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
  const tracking = `data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}"`;
  return `
    <article class="grid-card">
      <div class="thumb ${imageClass(item)}"${imageStyle(item)}></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${sourceBadges(item)} <span class="source-chip"><span class="dot-mark np">${escapeHtml(initials)}</span>${escapeHtml(item.source?.name || '256 Newsroom')}</span> · ${formatTime(item.publishedAt)}</p>
      <a href="${safeHref(item.url)}" class="read-link" ${tracking} target="_blank" rel="noopener">Click to read</a>
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
  if (eyebrow) eyebrow.innerHTML = `<span class="dot"></span>Hot &amp; Trending · ${escapeHtml(item.district?.name || (item.category?.slug === 'world' ? 'World' : 'Uganda'))}`;
  if (title) title.textContent = item.title;
  if (excerpt) excerpt.textContent = item.summary || 'Latest developing story from monitored Ugandan news sources.';
  if (image && item.imageUrl) image.setAttribute('style', imageStyle(item).replace(/^ style="/, '').replace(/"$/, ''));
  if (image && !item.imageUrl) image.removeAttribute('style');
  if (cap) cap.textContent = `${item.source?.name || '256 Newsroom'} · ${formatTime(item.publishedAt)}`;
  if (meta) {
    meta.innerHTML = `
      ${sourceBadges(item)}
      <span class="source-chip"><span class="dot-mark np">${escapeHtml(sourceInitials(item.source?.name))}</span>${escapeHtml(item.source?.name || '256 Newsroom')}</span>
      <span class="cluster-note">${item.source?.official ? 'Direct official source' : 'Live from approved source feed'}</span>
      <a href="${safeHref(item.url)}" class="read-link" data-story-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category?.slug || '')}" data-district="${escapeHtml(item.district?.slug || '')}" target="_blank" rel="noopener">Click to read</a>
    `;
  }
}

function startHeroRotation(items = []) {
  const stories = items.filter(Boolean);
  if (heroRotationTimer) clearInterval(heroRotationTimer);
  if (stories.length < 2) return;
  let index = 0;
  heroRotationTimer = setInterval(() => {
    index = (index + 1) % stories.length;
    setHero(stories[index]);
  }, 5000);
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
    <article class="cluster-card">
      <div class="trend-thumb ${imageClass(item)}"${imageStyle(item)}></div>
      <span class="cat-tag">${escapeHtml(item.category?.name || 'News')}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <div class="cmeta">${sourceBadges(item)}<span>${escapeHtml(item.source?.name || '256 Newsroom')}</span></div>
      <div class="trend-tag">updated ${formatTime(item.publishedAt)}</div>
      <a href="${safeHref(item.url)}" class="read-link" target="_blank" rel="noopener">Click to read</a>
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
  if (!mount || !items?.length) return;
  mount.innerHTML = '<div class="sidebar-title">256 AI Systems</div>' + items.slice(0, 7).map((item) => `
    <a class="eco-teaser-item" href="${safeHref(item.link) !== '#' ? safeHref(item.link) : '/#ecosystem'}" target="_blank" rel="noopener">
      <div class="side-thumb">${platformLogo(item) ? `<img src="${safeHref(platformLogo(item))}" alt="${escapeHtml(item.platform)} logo">` : `<span>${escapeHtml(item.mark || item.platform[0])}</span>`}</div>
      <div><b>${escapeHtml(item.platform)}</b><p>${escapeHtml(item.description || item.summary)}</p><span class="eco-domain">${escapeHtml(domainFromLink(item.link))}</span></div>
    </a>
  `).join('') + '<a href="/#ecosystem" data-tab-link="ecosystem" class="eco-teaser-more">VIEW ALL 256 AI SYSTEMS NEWS -></a>';
}

function setEcosystemGrid(items, officialItems = []) {
  const sections = [...document.querySelectorAll('#panel-home section')];
  const section = sections.find((candidate) => candidate.querySelector('.section-header h2')?.textContent.trim() === 'Latest from 256 AI Systems');
  const mount = section?.querySelector('.eco-grid');
  if (!mount) return;
  if (items?.length) {
    mount.innerHTML = items.slice(0, 6).map((item) => `
    <article class="eco-card">
      <a class="eco-card-media" href="${safeHref(item.url)}" target="_blank" rel="noopener">
        <div class="eco-card-thumb ${imageClass(item)}"${imageStyle(item)}><span>${escapeHtml(item.source?.name || 'Live News')}</span></div>
      </a>
      <div>
        <small>256 AI Systems <b>${item.source?.official ? 'OFFICIAL SOURCE' : 'PUBLISHED COVERAGE'}</b></small>
        <h3><a href="${safeHref(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a></h3>
        <p><a href="${safeHref(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.summary || 'Published coverage mentioning 256 AI Systems.')}</a></p>
        <footer><span>${formatTime(item.publishedAt)}</span><a href="${safeHref(item.url)}" target="_blank" rel="noopener">Read Full Update -></a></footer>
      </div>
    </article>
  `).join('');
    return;
  }
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
  if (!mount || !items?.length) return;
  mount.innerHTML = items.slice(0, 6).map((item) => `
    <article class="social-card">
      <div class="social-thumb ${imageClass(item)}"${imageStyle(item)}><span>${escapeHtml(item.source?.name || 'Live News')}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${sourceBadges(item)} ${escapeHtml(item.category?.name || 'News')} · ${formatTime(item.publishedAt)}</p>
      <b><a href="${safeHref(item.url)}" target="_blank" rel="noopener">Click to read</a></b>
    </article>
  `).join('');
}

function setCitizenLatest(items) {
  const mount = document.querySelector('.citizens-scroll');
  if (!mount || !items?.length) return;
  mount.innerHTML = `
    <label for="citizen-modal-toggle" class="citizen-submit-card"><span>+</span><b>Share what's happening near you</b></label>
    ${items.slice(0, 5).map((item) => `
      <article class="citizen-card">
        <div class="citizen-thumb ${imageClass(item)}"${imageStyle(item)}><span>LIVE NEWS</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.source?.name || '256 Newsroom')} · ${escapeHtml(item.district?.name || item.category?.name || 'Uganda')} · ${formatTime(item.publishedAt)}</p>
      </article>
    `).join('')}
  `;
}

function setJournalists(items, articles = []) {
  const mount = document.querySelector('.journalist-scroll');
  if (!mount) return;
  const articleProfiles = articles.slice(0, 6).map((article, index) => ({
    name: article.author || article.source?.name || '256 Newsroom',
    beat: `${article.category?.name || 'News'} · ${formatTime(article.publishedAt)}`,
    profile_url: article.url,
    imageUrl: article.imageUrl,
    reads: Math.round(Number(article.score || 0)),
    views: 0,
    sourceName: article.source?.name,
    index,
  }));
  const profiles = articleProfiles.length ? articleProfiles : (items || []);
  if (!profiles.length) return;
  mount.innerHTML = profiles.slice(0, 6).map((item, index) => `
    <a href="${safeHref(item.profile_url || '#')}" class="journalist-card ${index === 0 ? 'featured' : ''}">
      <span class="journalist-photo jp-${index + 1}"${item.imageUrl ? imageStyle({ imageUrl: item.imageUrl }) : ''}><span>${escapeHtml(sourceInitials(item.name))}</span></span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.beat || 'Journalist')}</p>
      <b>${item.sourceName ? 'Latest live byline/source' : `${Number(item.reads || 0).toLocaleString()} reads · ${Number(item.views || 0).toLocaleString()} views`}</b>
    </a>
  `).join('');
}

function setDistricts(items) {
  const mount = document.querySelector('.district-scroll');
  if (!mount) return;
  if (!items?.length) {
    mount.innerHTML = '<article class="district-card empty-card"><h3>No district-tagged stories yet</h3><p>Waiting for district metadata from approved source feeds.</p></article>';
    return;
  }
  mount.innerHTML = items.slice(0, 6).map((item) => `
    <article class="district-card">
      <div class="district-card-thumb ${imageClass(item)}"${imageStyle(item)}><span>${escapeHtml(item.district?.name || 'UGANDA')}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${sourceBadges(item)} <span class="source-chip"><span class="dot-mark np">${escapeHtml(sourceInitials(item.source?.name))}</span>${escapeHtml(item.source?.name || '256 Newsroom')}</span></p>
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
  setupCitizenReportForm();
  setupInterestTracking();
  setMastheadDate();
  try {
    const [hero, top, latest, national, world, sports, districtNews, ecosystemNews, sources, ecosystem, journalists, readerProfile] = await Promise.all([
      getJson('/news/hero?limit=12'),
      getJson('/news/top?limit=12'),
      getJson('/news/latest?limit=12'),
      getJson('/news/category/national?limit=6'),
      getJson('/news/category/world?limit=6'),
      getJson('/news/category/sports?limit=6'),
      getJson('/news/districts/latest?limit=12'),
      getJson('/news/ecosystem?limit=6'),
      getJson('/news/sources/top?limit=50'),
      getJson('/ecosystem'),
      getJson('/journalists/top?limit=6'),
      resolveReaderProfile(),
    ]);
    const heroStories = personalizeItems(hero.items || [], readerProfile);
    const topStories = personalizeItems(top.items || [], readerProfile);
    const latestStories = personalizeItems(latest.items || [], readerProfile);
    const districtStories = personalizeItems(districtNews.items || [], readerProfile);

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
    setTopSources((sources.items || []).slice(0, 9));
    setEcosystem(ecosystem.items || []);
    setJournalists(journalists.items, latestStories);
    await setCategoryTabs(districtStories);
    startCarouselRotation();
  } catch (err) {
    const statusEl = document.getElementById('masthead-status');
    if (statusEl) statusEl.textContent = 'Live sources temporarily unavailable';
    console.warn('Live news unavailable:', err.message);
  }
}

bootLiveNews();
