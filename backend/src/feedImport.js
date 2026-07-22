const Parser = require('rss-parser');
const pool = require('./db');

const FEED_USER_AGENT = '256NewsroomBot/1.0 (+https://256newsroom.com)';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': FEED_USER_AGENT },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

function sanitizeFeedXml(xml) {
  return xml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

function cleanText(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function imageFromItem(item) {
  const baseUrl = item.link || item.guid;
  const resolve = (value) => {
    if (!value) return null;
    try {
      const url = new URL(String(value).replace(/&amp;/g, '&').trim(), baseUrl);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch { return null; }
  };
  if (item.enclosure && item.enclosure.url) return resolve(item.enclosure.url);
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) return resolve(item.mediaContent.$.url);
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) return resolve(item.mediaThumbnail.$.url);
  const html = item.contentEncoded || item.content || '';
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? resolve(match[1]) : null;
}

async function fetchAndParseFeed(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': FEED_USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(`Feed request failed with status ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  const raw = await res.text();
  return parser.parseString(sanitizeFeedXml(raw));
}

async function previewFeed(feedUrl, limit = 10) {
  const feed = await fetchAndParseFeed(feedUrl);
  return (feed.items || []).slice(0, limit).map((item) => ({
    title: cleanText(item.title),
    link: item.link || item.guid || null,
    publishedAt: item.isoDate || item.pubDate || null,
    summary: cleanText(item.contentSnippet || item.summary || item.content || '').slice(0, 300),
    imageUrl: imageFromItem(item),
  }));
}

// domain_verified_at plus an approved org unlocks auto-publish; an admin can
// also unlock it per-feed via admin_auto_publish_override regardless of org
// verification status.
function resolveEffectivePublishMode(rule, subscription, org) {
  if (rule.publish_mode !== 'auto_publish') return 'draft';
  const orgApproved = org && (org.verification_status === 'approved' || org.is_official);
  const domainAuthorized = Boolean(subscription.domain_verified_at);
  if (subscription.admin_auto_publish_override) return 'auto_publish';
  if (orgApproved && domainAuthorized) return 'auto_publish';
  return 'draft';
}

async function importSubscription(subscription) {
  const { rows: orgRows } = await pool.query('select verification_status, is_official from organizations where id = $1', [subscription.organization_id]);
  const org = orgRows[0];
  const { rows: ruleRows } = await pool.query('select * from feed_import_rules where subscription_id = $1 and active = true limit 1', [subscription.id]);
  const rule = ruleRows[0] || { content_mode: 'headline_summary_image', category_id: null, district_id: null, publish_mode: 'draft' };

  const logRes = await pool.query(
    `insert into feed_import_logs (subscription_id, status) values ($1, 'running') returning id`,
    [subscription.id],
  );
  const logId = logRes.rows[0].id;

  let itemsFound = 0;
  let itemsImported = 0;

  try {
    const feed = await fetchAndParseFeed(subscription.feed_url);
    itemsFound = (feed.items || []).length;
    const effectivePublishMode = resolveEffectivePublishMode(rule, subscription, org);
    const contentMode = rule.content_mode || subscription.content_mode || 'headline_summary_image';

    for (const item of feed.items || []) {
      const title = cleanText(item.title);
      const link = item.link || item.guid;
      if (!title || !link) continue;

      const summary = contentMode === 'headline_only' ? null : cleanText(item.contentSnippet || item.summary || item.content || '').slice(0, 420);
      const imageUrl = contentMode === 'headline_only' ? null : imageFromItem(item);
      const publishedAt = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate) : null;
      const status = effectivePublishMode === 'auto_publish' ? 'published' : 'draft';

      // articles.url is unique across the whole table, shared with the
      // separate crawler (see scripts/crawl.js). A publisher connecting the
      // feed of an outlet the crawler already ingests must never silently
      // overwrite that crawled row or claim it as their own — only refresh
      // an article this same subscription previously imported; otherwise
      // skip and leave the existing row (crawled, or another org's import)
      // untouched.
      const { rows: existingRows } = await pool.query('select id, feed_subscription_id from articles where url = $1', [link]);
      const existing = existingRows[0];

      if (existing && existing.feed_subscription_id === subscription.id) {
        await pool.query(
          `update articles set title = $2, summary = $3, image_url = coalesce($4, image_url), updated_at = now()
           where id = $1`,
          [existing.id, title, summary, imageUrl],
        );
      } else if (!existing) {
        await pool.query(
          `insert into articles
            (organization_id, origin, feed_subscription_id, title, summary, url, external_url, image_url,
             category_id, district_id, published_at, status, hidden, score)
           values ($1,'external_feed_import',$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,false,1)`,
          [
            subscription.organization_id, subscription.id, title, summary, link, imageUrl,
            rule.category_id, rule.district_id, publishedAt, status,
          ],
        );
        itemsImported += 1;
      }
      // else: URL already belongs to the crawler or a different subscription — skip.
    }

    await pool.query(
      `update external_feed_subscriptions set
         last_polled_at = now(), last_error = null, validation_status = 'valid', validated_at = now(), updated_at = now()
       where id = $1`,
      [subscription.id],
    );
    await pool.query(
      `update feed_import_logs set status = 'success', items_found = $2, items_imported = $3, finished_at = now() where id = $1`,
      [logId, itemsFound, itemsImported],
    );
    return { subscriptionId: subscription.id, status: 'success', itemsFound, itemsImported };
  } catch (err) {
    await pool.query(
      `update external_feed_subscriptions set
         last_polled_at = now(), last_error = $2, validation_status = 'invalid', updated_at = now()
       where id = $1`,
      [subscription.id, err.message],
    );
    await pool.query(
      `update feed_import_logs set status = 'error', items_found = $2, items_imported = $3, error = $4, finished_at = now() where id = $1`,
      [logId, itemsFound, itemsImported, err.message],
    );
    return { subscriptionId: subscription.id, status: 'error', error: err.message };
  }
}

async function pollDueFeeds() {
  const { rows: due } = await pool.query(`
    select * from external_feed_subscriptions
    where active = true
      and (last_polled_at is null or last_polled_at < now() - (poll_interval_minutes || ' minutes')::interval)
  `);
  const results = [];
  for (const subscription of due) {
    results.push(await importSubscription(subscription));
  }
  return { ok: true, polledAt: new Date().toISOString(), results };
}

module.exports = {
  fetchAndParseFeed,
  previewFeed,
  importSubscription,
  pollDueFeeds,
  resolveEffectivePublishMode,
};
