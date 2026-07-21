const crypto = require('crypto');
const Parser = require('rss-parser');
const pool = require('../src/db');

const FEED_USER_AGENT = '256NewsroomBot/1.0 (+https://256newsroom.com)';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': FEED_USER_AGENT,
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
      ['source', 'gnSource'],
    ],
  },
});

function sanitizeFeedXml(xml) {
  return xml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

async function fetchAndParseFeed(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': FEED_USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(`Status code ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  const raw = await res.text();
  return parser.parseString(sanitizeFeedXml(raw));
}

const categoryKeywords = [
  ['politics', ['parliament', 'election', 'cabinet', 'minister', 'president', 'speaker', 'mp ', 'government']],
  ['business', ['business', 'bank', 'bou', 'tax', 'ura', 'coffee', 'market', 'trade', 'economy', 'fuel']],
  ['sports', ['cranes', 'football', 'sport', 'league', 'kcca fc', 'netball', 'marathon', 'fufa']],
  ['health', ['health', 'hospital', 'malaria', 'doctor', 'clinic', 'medicine']],
  ['education', ['school', 'education', 'university', 'student', 'makerere']],
  ['technology', ['technology', 'digital', 'cyber', 'artificial intelligence', 'software']],
];

const ecosystemKeywords = [
  '256 heart',
  '256heart',
  '256 corporate',
  '256corporate',
  '256 mall',
  '256mall',
  '256 express',
  '256express',
  '256shield',
  '256 shield',
  '256 ai',
  '256ai',
  '256linkshield',
  '256 linkshield',
  '256 ecosystem',
  '256 ai systems',
  '256 group',
  'queen dorothy amolo',
  'dorothy amolo',
  'jason boyle',
  'r. boyle',
  'r boyle',
  'enterprise.256',
  'shield.256',
  'ai.256',
];

const districtNames = [
  'kampala',
  'wakiso',
  'mbarara',
  'gulu',
  'jinja',
  'mbale',
  'arua',
  'masaka',
  'lira',
  'hoima',
  'kasese',
  'kabale',
  'kisoro',
  'bushenyi',
  'sheema',
  'rubanda',
  'kanungu',
  'fort portal',
  'soroti',
  'mukono',
  'entebbe',
  'luweero',
  'kayunga',
  'amuria',
  'namisindwa',
  'bugiri',
  'kween',
  'obongi',
  'kitgum',
  'moroto',
  'napak',
  'oyam',
  'dokolo',
  'nakasongola',
  'nakasero',
];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(title, summary, url = '', itemCategories = [], source = {}) {
  if (source.default_category_slug && source.source_type !== 'local_publisher') {
    return source.default_category_slug;
  }

  const urlText = String(url || '').toLowerCase();
  const categoryText = itemCategories.join(' ').toLowerCase();
  const haystack = `${title} ${summary} ${categoryText}`.toLowerCase();

  if (ecosystemKeywords.some((keyword) => haystack.includes(keyword) || urlText.includes(keyword))) return 'ecosystem';
  if (/\/sports?\//.test(urlText) || /\bsports?\b/.test(categoryText)) return 'sports';
  if (/\/business\//.test(urlText) || /\bbusiness\b/.test(categoryText)) return 'business';
  if (/\/(politics|elections?)\//.test(urlText) || /\b(politics|elections?)\b/.test(categoryText)) return 'politics';
  if (/\/(health|medical)\//.test(urlText) || /\bhealth\b/.test(categoryText)) return 'health';
  if (/\/education\//.test(urlText) || /\beducation\b/.test(categoryText)) return 'education';
  if (/\/(technology|tech)\//.test(urlText) || /\b(technology|tech)\b/.test(categoryText)) return 'technology';
  if (/\/(world|international|africa|east-africa)\//.test(urlText) || /\b(world|international|africa|east africa)\b/.test(categoryText)) return 'world';

  for (const [slug, keywords] of categoryKeywords) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return slug;
  }
  return 'national';
}

function detectDistrict(title, summary) {
  const titleText = String(title || '').toLowerCase();
  const summaryText = String(summary || '').toLowerCase();
  const district = districtNames.find((name) => titleText.includes(name))
    || districtNames.find((name) => summaryText.includes(name));
  return district ? slugify(district) : null;
}

function scoreArticle(item) {
  const rawDate = item.isoDate || item.pubDate;
  const published = rawDate ? new Date(rawDate) : null;
  if (!published || Number.isNaN(published.getTime())) return 1;
  const hoursOld = Math.max(1, (Date.now() - published.getTime()) / 36e5);
  return Math.max(1, Math.round(1000 / Math.sqrt(hoursOld)));
}

function imageFromItem(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) return item.mediaThumbnail.$.url;
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) return item['media:content'].$.url;
  const html = item.contentEncoded || item['content:encoded'] || item.content || '';
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

async function idFor(table, slug) {
  if (!slug) return null;
  const { rows } = await pool.query(`select id from ${table} where slug = $1 limit 1`, [slug]);
  return rows[0] ? rows[0].id : null;
}

async function upsertCluster({ title, summary, categoryId, districtId, score }) {
  const words = cleanText(title).toLowerCase().split(/\s+/).filter((word) => word.length > 3).slice(0, 8).join(' ');
  const clusterKey = crypto.createHash('sha1').update(words || title).digest('hex');
  const { rows } = await pool.query(`
    insert into story_clusters (cluster_key, title, summary, category_id, district_id, score, source_count, last_seen_at)
    values ($1, $2, $3, $4, $5, $6, 1, now())
    on conflict (cluster_key) do update set
      last_seen_at = now(),
      score = greatest(story_clusters.score, excluded.score),
      source_count = story_clusters.source_count + 1
    returning id
  `, [clusterKey, title, summary, categoryId, districtId, score]);
  return rows[0].id;
}

async function crawlSource(source) {
  const started = new Date();
  let logId;
  try {
    const log = await pool.query(
      'insert into crawl_logs (source_id, feed_url, status, started_at) values ($1, $2, $3, $4) returning id',
      [source.id, source.feed_url, 'running', started],
    );
    logId = log.rows[0].id;
    const feed = await fetchAndParseFeed(source.feed_url);
    let inserted = 0;

    for (const item of feed.items || []) {
      const title = cleanText(item.title);
      const url = item.link || item.guid;
      if (!title || !url) continue;

      const summary = cleanText(item.contentSnippet || item.summary || item.content || '').slice(0, 420);
      const categorySlug = classify(title, summary, url, item.categories || [], source);
      const districtSlug = detectDistrict(title, summary);
      const categoryId = await idFor('categories', categorySlug);
      const districtId = await idFor('districts', districtSlug);
      const score = scoreArticle(item);
      const clusterId = await upsertCluster({ title, summary, categoryId, districtId, score });
      const publishedAt = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate) : null;

      const result = await pool.query(`
        insert into articles
          (source_id, cluster_id, category_id, district_id, title, summary, url, image_url, author, published_at, score)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (url) do update set
          title = excluded.title,
          summary = excluded.summary,
          image_url = coalesce(excluded.image_url, articles.image_url),
          category_id = excluded.category_id,
          district_id = excluded.district_id,
          score = greatest(articles.score, excluded.score),
          updated_at = now()
        returning (xmax = 0) as inserted
      `, [source.id, clusterId, categoryId, districtId, title, summary, url, imageFromItem(item), item.creator || item.author || null, publishedAt, score]);

      if (result.rows[0] && result.rows[0].inserted) inserted += 1;
    }

    await pool.query(
      'update crawl_logs set status = $1, items_found = $2, items_inserted = $3, finished_at = now() where id = $4',
      ['success', (feed.items || []).length, inserted, logId],
    );
    return { source: source.name, status: 'success', found: (feed.items || []).length, inserted };
  } catch (err) {
    if (logId) {
      await pool.query('update crawl_logs set status = $1, error = $2, finished_at = now() where id = $3', ['error', err.message, logId]);
    }
    return { source: source.name, status: 'error', error: err.message };
  }
}

const NEWSAPI_CATEGORIES = [
  ['business', 'business'],
  ['general', 'world'],
  ['health', 'health'],
  ['sports', 'sports'],
  ['technology', 'technology'],
];

async function upsertAggregatedSource(name, homepageUrl, defaultCategoryId, sourceType) {
  const slug = slugify(name).slice(0, 60) || crypto.createHash('sha1').update(name).digest('hex').slice(0, 12);
  const { rows } = await pool.query(`
    insert into sources (name, slug, homepage_url, feed_url, source_type, default_category_id, active, approved)
    values ($1, $2, $3, null, $4, $5, true, true)
    on conflict (slug) do update set homepage_url = coalesce(sources.homepage_url, excluded.homepage_url)
    returning id
  `, [name.slice(0, 120), slug, homepageUrl, sourceType, defaultCategoryId]);
  return rows[0].id;
}

// Normalized item shape: { title, url, summary, imageUrl, author, publishedAt, sourceName, sourceHomepage }
async function ingestAggregatedArticles(label, items, defaultCategorySlug, sourceType) {
  const started = new Date();
  const log = await pool.query(
    'insert into crawl_logs (source_id, feed_url, status, started_at) values (null, $1, $2, $3) returning id',
    [`${sourceType}:${label}`, 'running', started],
  );
  const logId = log.rows[0].id;
  const defaultCategoryId = defaultCategorySlug ? await idFor('categories', defaultCategorySlug) : null;
  let inserted = 0;

  try {
    for (const item of items) {
      const title = cleanText(item.title);
      const url = item.url;
      if (!title || !url || title === '[Removed]') continue;

      const outletName = item.sourceName || label;
      const sourceId = await upsertAggregatedSource(outletName, item.sourceHomepage || null, defaultCategoryId, sourceType);

      const summary = cleanText(item.summary || '').slice(0, 420);
      const categorySlug = defaultCategorySlug || classify(title, summary, url, [], {});
      const districtSlug = detectDistrict(title, summary);
      const categoryId = defaultCategoryId || await idFor('categories', categorySlug);
      const districtId = await idFor('districts', districtSlug);
      const score = scoreArticle({ isoDate: item.publishedAt });
      const clusterId = await upsertCluster({ title, summary, categoryId, districtId, score });
      const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;

      const result = await pool.query(`
        insert into articles
          (source_id, cluster_id, category_id, district_id, title, summary, url, image_url, author, published_at, score)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (url) do update set
          title = excluded.title,
          summary = excluded.summary,
          image_url = coalesce(excluded.image_url, articles.image_url),
          category_id = excluded.category_id,
          district_id = excluded.district_id,
          score = greatest(articles.score, excluded.score),
          updated_at = now()
        returning (xmax = 0) as inserted
      `, [sourceId, clusterId, categoryId, districtId, title, summary, url, item.imageUrl || null, item.author || null, publishedAt, score]);

      if (result.rows[0] && result.rows[0].inserted) inserted += 1;
    }

    await pool.query(
      'update crawl_logs set status = $1, items_found = $2, items_inserted = $3, finished_at = now() where id = $4',
      ['success', items.length, inserted, logId],
    );
    return { source: `${sourceType}:${label}`, status: 'success', found: items.length, inserted };
  } catch (err) {
    await pool.query('update crawl_logs set status = $1, error = $2, finished_at = now() where id = $3', ['error', err.message, logId]);
    return { source: `${sourceType}:${label}`, status: 'error', error: err.message };
  }
}

async function fetchNewsApi(path) {
  const res = await fetch(`https://newsapi.org/v2/${path}`, {
    headers: { 'X-Api-Key': process.env.NEWSAPI_KEY },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (!res.ok || body.status !== 'ok') {
    throw new Error(body.message || `NewsAPI request failed with status ${res.status}`);
  }
  return body.articles || [];
}

function normalizeNewsApiArticle(item) {
  let sourceHomepage = null;
  try { sourceHomepage = new URL(item.url).origin; } catch { /* leave null */ }
  return {
    title: item.title,
    url: item.url,
    summary: item.description || item.content || '',
    imageUrl: item.urlToImage || null,
    author: item.author || null,
    publishedAt: item.publishedAt || null,
    sourceName: (item.source && item.source.name) || 'NewsAPI',
    sourceHomepage,
  };
}

async function crawlNewsApiSources() {
  if (!process.env.NEWSAPI_KEY) {
    return { ok: false, crawledAt: new Date().toISOString(), results: [{ source: 'newsapi', status: 'error', error: 'NEWSAPI_KEY not configured' }] };
  }

  const results = [];
  for (const [category, categorySlug] of NEWSAPI_CATEGORIES) {
    try {
      const articles = await fetchNewsApi(`top-headlines?category=${category}&language=en&pageSize=100`);
      results.push(await ingestAggregatedArticles(`top-headlines:${category}`, articles.map(normalizeNewsApiArticle), categorySlug, 'newsapi'));
    } catch (err) {
      results.push({ source: `newsapi:top-headlines:${category}`, status: 'error', error: err.message });
    }
  }

  try {
    const ugandaArticles = await fetchNewsApi('everything?q=Uganda&language=en&sortBy=publishedAt&pageSize=50');
    results.push(await ingestAggregatedArticles('everything:uganda', ugandaArticles.map(normalizeNewsApiArticle), null, 'newsapi'));
  } catch (err) {
    results.push({ source: 'newsapi:everything:uganda', status: 'error', error: err.message });
  }

  return { ok: true, crawledAt: new Date().toISOString(), results };
}

const GOOGLE_NEWS_TOPICS = [
  ['business', 'business'],
  ['technology', 'technology'],
  ['sports', 'sports'],
  ['health', 'health'],
  ['world', 'world'],
  ['Africa', 'world'],
];

function normalizeGoogleNewsItem(item) {
  const title = cleanText(item.title || '').replace(/\s+-\s+[^-]+$/, '');
  return {
    title,
    url: item.link,
    summary: item.contentSnippet || '',
    imageUrl: imageFromItem(item),
    author: null,
    publishedAt: item.isoDate || item.pubDate || null,
    sourceName: item.gnSource || 'Google News',
    sourceHomepage: null,
  };
}

async function crawlGoogleNewsTopics() {
  const results = [];

  for (const [query, categorySlug] of GOOGLE_NEWS_TOPICS) {
    try {
      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:1d&hl=en-UG&gl=UG&ceid=UG:en`;
      const feed = await fetchAndParseFeed(feedUrl);
      const items = (feed.items || []).map(normalizeGoogleNewsItem);
      results.push(await ingestAggregatedArticles(`topic:${query}`, items, categorySlug, 'googlenews'));
    } catch (err) {
      results.push({ source: `googlenews:topic:${query}`, status: 'error', error: err.message });
    }
  }

  try {
    const feedUrl = 'https://news.google.com/rss?hl=en-UG&gl=UG&ceid=UG:en';
    const feed = await fetchAndParseFeed(feedUrl);
    const items = (feed.items || []).map(normalizeGoogleNewsItem);
    results.push(await ingestAggregatedArticles('uganda-top-stories', items, null, 'googlenews'));
  } catch (err) {
    results.push({ source: 'googlenews:uganda-top-stories', status: 'error', error: err.message });
  }

  return { ok: true, crawledAt: new Date().toISOString(), results };
}

async function crawlAllSources() {
  const { rows: sources } = await pool.query(`
    select s.*, c.slug as default_category_slug
    from sources s
    left join categories c on c.id = s.default_category_id
    where s.active = true and s.approved = true and s.feed_url is not null
    order by s.name
  `);
  const results = [];
  for (const source of sources) {
    results.push(await crawlSource(source));
  }
  return { ok: true, crawledAt: new Date().toISOString(), results };
}

if (require.main === module) {
  crawlAllSources()
    .then(async (result) => {
      console.log(JSON.stringify(result, null, 2));
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}

module.exports = { crawlAllSources, crawlNewsApiSources, crawlGoogleNewsTopics };
