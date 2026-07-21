const crypto = require('crypto');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const pool = require('./db');

const FETCH_USER_AGENT = '256NewsroomEcosystemBot/1.0 (+https://256newsroom.com; official 256 platform content discovery)';
const MAX_REDIRECTS = 5;
const CHROME_PATH = process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
// Below this, a plain-HTTP fetch is treated as an empty SPA shell (e.g. a
// bare `<div id="root"></div>`) and re-fetched with headless rendering.
const MIN_STATIC_TEXT_LENGTH = 200;

// Chrome is heavy (this box already runs it for other services and is under
// real memory pressure) — never run two renders at once. Each render also
// launches and closes its own browser rather than keeping one resident.
let renderQueue = Promise.resolve();
function withRenderLock(fn) {
  const run = renderQueue.then(fn, fn);
  renderQueue = run.catch(() => {});
  return run;
}

class DomainNotApprovedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainNotApprovedError';
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function domainAllowed(hostname, approvedDomains) {
  if (!hostname) return false;
  return approvedDomains.some((d) => {
    const norm = d.replace(/^www\./, '').toLowerCase();
    return hostname.toLowerCase() === norm || hostname.toLowerCase().endsWith(`.${norm}`);
  });
}

// Manually walks redirects (rather than letting fetch follow them
// transparently) so every hop can be checked against the organization's
// approved domain list — a redirect that leaves the allowlist is rejected
// rather than silently followed.
async function fetchWithApprovedRedirects(startUrl, approvedDomains) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const hostname = hostnameOf(url);
    if (!domainAllowed(hostname, approvedDomains)) {
      throw new DomainNotApprovedError(`${hostname || url} is not an approved domain for this platform.`);
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': FETCH_USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`Redirect from ${url} had no Location header.`);
      url = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) {
      const err = new Error(`Fetch failed with status ${res.status} for ${url}`);
      err.statusCode = res.status;
      throw err;
    }
    const html = await res.text();
    return { finalUrl: url, html };
  }
  throw new Error(`Too many redirects starting from ${startUrl}`);
}

// Falls back for client-rendered SPA shells (256 AI, 256 Mall, 256 Express,
// 256 Heart all serve an empty <div id="root"> over plain HTTP — there is
// nothing to extract until JS actually runs). Re-resolves the final URL
// after rendering and re-checks it against the approved domain list, since
// client-side routing/redirects aren't covered by fetchWithApprovedRedirects.
async function renderWithHeadlessBrowser(url, approvedDomains) {
  return withRenderLock(async () => {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(FETCH_USER_AGENT);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      const finalUrl = page.url();
      const finalHostname = hostnameOf(finalUrl);
      if (!domainAllowed(finalHostname, approvedDomains)) {
        throw new DomainNotApprovedError(`Rendered page navigated to an unapproved domain (${finalHostname}).`);
      }
      const html = await page.content();
      return { finalUrl, html };
    } finally {
      await browser.close();
    }
  });
}

const REMOVE_SELECTORS = [
  'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form',
  'iframe', 'svg', '[aria-hidden="true"]', '.cookie-banner', '.newsletter-signup',
];

// Public-page-only extraction: strips chrome/nav/scripts, keeps only what a
// human visitor would read as the page's actual content. No login, no
// authenticated fetch — this only ever sees what an anonymous browser sees.
function extractPageContent(html, url) {
  const $ = cheerio.load(html);
  REMOVE_SELECTORS.forEach((sel) => $(sel).remove());

  const title = $('meta[property="og:title"]').attr('content')
    || $('title').first().text()
    || $('h1').first().text()
    || '';

  const main = $('main, article, [role="main"]').first();
  const contentRoot = main.length ? main : $('body');
  const textContent = contentRoot.text().replace(/\s+/g, ' ').trim();

  const ogImage = $('meta[property="og:image"]').attr('content');
  const firstContentImage = contentRoot.find('img').first().attr('src');
  let imageUrl = ogImage || firstContentImage || null;
  if (imageUrl) {
    try { imageUrl = new URL(imageUrl, url).toString(); } catch { imageUrl = null; }
  }

  const description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || null;

  return {
    title: title.trim().slice(0, 300),
    textContent,
    description: description ? description.trim().slice(0, 500) : null,
    imageUrl,
  };
}

function computeContentHash(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

async function getApprovedDomains(organizationId) {
  const { rows } = await pool.query(
    'select domain from approved_domains where organization_id = $1 and active = true',
    [organizationId],
  );
  return rows.map((r) => r.domain);
}

async function isExcluded(organizationId, url) {
  const { rows } = await pool.query('select url_pattern from excluded_urls where organization_id = $1', [organizationId]);
  return rows.some((r) => url.includes(r.url_pattern));
}

// Fetches one configured source page, extracts its content, and records the
// evidence snapshot — this alone does not generate or publish anything.
async function discoverSource(organizationId, sourceUrl) {
  const approvedDomains = await getApprovedDomains(organizationId);
  if (!approvedDomains.length) {
    throw new Error('This platform has no approved domains configured yet.');
  }
  if (await isExcluded(organizationId, sourceUrl)) {
    throw new Error('This URL is excluded for this platform.');
  }

  let { finalUrl, html } = await fetchWithApprovedRedirects(sourceUrl, approvedDomains);
  let extracted = extractPageContent(html, finalUrl);
  let renderedWithBrowser = false;

  if (extracted.textContent.length < MIN_STATIC_TEXT_LENGTH) {
    const rendered = await renderWithHeadlessBrowser(finalUrl, approvedDomains);
    finalUrl = rendered.finalUrl;
    html = rendered.html;
    extracted = extractPageContent(html, finalUrl);
    renderedWithBrowser = true;
  }

  const contentHash = computeContentHash(extracted.textContent);

  const { rows: existingRows } = await pool.query(
    'select id, content_hash from source_evidence where organization_id = $1 and source_url = $2 order by discovered_at desc limit 1',
    [organizationId, sourceUrl],
  );
  const previous = existingRows[0];
  const changed = !previous || previous.content_hash !== contentHash;

  const { rows } = await pool.query(
    `insert into source_evidence
      (organization_id, source_url, canonical_url, source_page_title, content_hash, raw_text_snapshot, image_url)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [organizationId, sourceUrl, finalUrl, extracted.title, contentHash, extracted.textContent, extracted.imageUrl],
  );

  return {
    evidence: rows[0],
    extracted,
    isNewOrChanged: changed,
    previousEvidenceId: previous?.id || null,
    renderedWithBrowser,
  };
}

module.exports = {
  DomainNotApprovedError,
  hostnameOf,
  domainAllowed,
  fetchWithApprovedRedirects,
  renderWithHeadlessBrowser,
  extractPageContent,
  computeContentHash,
  getApprovedDomains,
  isExcluded,
  discoverSource,
};
