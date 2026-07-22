const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireOrgAccess, requireRole } = require('../auth');
const { previewFeed, importSubscription } = require('../feedImport');

const router = express.Router();

router.use('/:orgId(\\d+)/feeds', requireAuth, requireOrgAccess('orgId'));

async function loadSubscription(req, res, next) {
  const { rows } = await pool.query(
    'select * from external_feed_subscriptions where id = $1 and organization_id = $2',
    [req.params.id, req.params.orgId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Feed not found.' });
  req.subscription = rows[0];
  next();
}

async function loadOrg(orgId) {
  const { rows } = await pool.query('select * from organizations where id = $1', [orgId]);
  return rows[0];
}

router.get('/:orgId(\\d+)/feeds', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select s.*, r.publish_mode, r.content_mode, r.category_id, r.district_id
       from external_feed_subscriptions s
       left join feed_import_rules r on r.subscription_id = s.id and r.active = true
       where s.organization_id = $1
       order by s.created_at desc`,
      [req.params.orgId],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/feeds', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const feedUrl = String(req.body.feedUrl || '').trim().slice(0, 1000);
    if (!/^https?:\/\//i.test(feedUrl)) return res.status(400).json({ error: 'A valid http(s) feed URL is required.' });

    const contentMode = ['headline_only', 'headline_summary_image'].includes(req.body.contentMode) ? req.body.contentMode : 'headline_summary_image';
    const pollIntervalMinutes = Math.max(15, Number(req.body.pollIntervalMinutes) || 30);
    const categoryId = req.body.categorySlug
      ? (await pool.query('select id from categories where slug = $1', [req.body.categorySlug])).rows[0]?.id || null
      : null;
    const districtId = req.body.districtSlug
      ? (await pool.query('select id from districts where slug = $1', [req.body.districtSlug])).rows[0]?.id || null
      : null;

    await client.query('begin');
    // New feeds always start in draft mode — auto-publish must be turned on
    // explicitly afterward, and only once the org is approved and the feed's
    // domain is verified (see PATCH below).
    const { rows: subRows } = await client.query(
      `insert into external_feed_subscriptions
        (organization_id, feed_url, poll_interval_minutes, created_by_user_id)
       values ($1, $2, $3, $4)
       returning *`,
      [req.params.orgId, feedUrl, pollIntervalMinutes, req.user.id],
    );
    const subscription = subRows[0];
    await client.query(
      `insert into feed_import_rules (subscription_id, category_id, district_id, publish_mode, content_mode)
       values ($1, $2, $3, 'draft', $4)`,
      [subscription.id, categoryId, districtId, contentMode],
    );
    await client.query('commit');
    res.status(201).json({ item: subscription });
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/:orgId(\\d+)/feeds/:id', loadSubscription, async (req, res, next) => {
  try {
    if (req.body.active !== undefined) {
      await pool.query('update external_feed_subscriptions set active = $2, updated_at = now() where id = $1', [req.subscription.id, Boolean(req.body.active)]);
    }
    if (req.body.pollIntervalMinutes !== undefined) {
      const minutes = Math.max(15, Number(req.body.pollIntervalMinutes) || 30);
      await pool.query('update external_feed_subscriptions set poll_interval_minutes = $2, updated_at = now() where id = $1', [req.subscription.id, minutes]);
    }

    const ruleFields = {};
    if (req.body.publishMode !== undefined) {
      if (!['draft', 'auto_publish'].includes(req.body.publishMode)) return res.status(400).json({ error: "publishMode must be 'draft' or 'auto_publish'." });
      if (req.body.publishMode === 'auto_publish') {
        const org = await loadOrg(req.params.orgId);
        const orgApproved = org.verification_status === 'approved' || org.is_official;
        if (!(req.subscription.admin_auto_publish_override || (orgApproved && req.subscription.domain_verified_at))) {
          return res.status(403).json({ error: 'Auto-publish requires an approved organization and a domain-verified feed.' });
        }
      }
      ruleFields.publish_mode = req.body.publishMode;
    }
    if (req.body.contentMode !== undefined) {
      if (!['headline_only', 'headline_summary_image'].includes(req.body.contentMode)) return res.status(400).json({ error: 'Invalid contentMode.' });
      ruleFields.content_mode = req.body.contentMode;
    }
    if (req.body.categorySlug !== undefined) {
      ruleFields.category_id = req.body.categorySlug
        ? (await pool.query('select id from categories where slug = $1', [req.body.categorySlug])).rows[0]?.id || null
        : null;
    }
    if (req.body.districtSlug !== undefined) {
      ruleFields.district_id = req.body.districtSlug
        ? (await pool.query('select id from districts where slug = $1', [req.body.districtSlug])).rows[0]?.id || null
        : null;
    }
    if (Object.keys(ruleFields).length) {
      const sets = Object.keys(ruleFields).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await pool.query(
        `update feed_import_rules set ${sets}, updated_at = now() where subscription_id = $1`,
        [req.subscription.id, ...Object.values(ruleFields)],
      );
    }

    const { rows } = await pool.query('select * from external_feed_subscriptions where id = $1', [req.subscription.id]);
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId(\\d+)/feeds/:id', loadSubscription, async (req, res, next) => {
  try {
    await pool.query('delete from external_feed_subscriptions where id = $1', [req.subscription.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId(\\d+)/feeds/:id/preview', loadSubscription, async (req, res, next) => {
  try {
    const items = await previewFeed(req.subscription.feed_url);
    res.json({ items });
  } catch (err) {
    res.status(502).json({ error: `Could not read this feed: ${err.message}` });
  }
});

router.get('/:orgId(\\d+)/feeds/:id/logs', loadSubscription, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select * from feed_import_logs where subscription_id = $1 order by started_at desc limit 30',
      [req.subscription.id],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/feeds/:id/poll-now', loadSubscription, async (req, res, next) => {
  try {
    const result = await importSubscription(req.subscription);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/feeds/:id/verify/start', loadSubscription, async (req, res, next) => {
  try {
    const token = `256newsroom-feed-verify-${crypto.randomBytes(12).toString('hex')}`;
    await pool.query('update external_feed_subscriptions set domain_verification_token = $2, updated_at = now() where id = $1', [req.subscription.id, token]);
    res.json({
      token,
      instructions: `Add <meta name="256newsroom-verification" content="${token}"> to the homepage <head> of this feed's website, then call the check endpoint.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId(\\d+)/feeds/:id/verify/check', loadSubscription, async (req, res, next) => {
  try {
    if (!req.subscription.domain_verification_token) return res.status(400).json({ error: 'Start domain verification first.' });
    let origin;
    try {
      origin = new URL(req.subscription.feed_url).origin;
    } catch {
      return res.status(400).json({ error: 'This feed does not have a valid URL to verify.' });
    }

    let verified = false;
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(10000) });
      const html = await response.text();
      verified = html.includes(req.subscription.domain_verification_token);
    } catch (err) {
      return res.status(502).json({ error: `Could not fetch the feed's website: ${err.message}` });
    }

    if (!verified) return res.status(400).json({ error: 'Verification token not found on the website homepage.' });

    await pool.query('update external_feed_subscriptions set domain_verified_at = now(), updated_at = now() where id = $1', [req.subscription.id]);
    res.json({ ok: true, domainVerifiedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

const adminRouter = express.Router();
module.exports = router;
module.exports.adminRouter = adminRouter;

adminRouter.post('/:id/override-auto-publish', requireRole('super_admin', 'newsroom_admin'), async (req, res, next) => {
  try {
    const enabled = req.body.enabled !== false;
    const { rows } = await pool.query(
      'update external_feed_subscriptions set admin_auto_publish_override = $2, updated_at = now() where id = $1 returning *',
      [req.params.id, enabled],
    );
    if (!rows.length) return res.status(404).json({ error: 'Feed not found.' });
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/', requireRole('super_admin', 'newsroom_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select s.*, o.name as organization_name, o.slug as organization_slug
       from external_feed_subscriptions s
       join organizations o on o.id = s.organization_id
       order by s.created_at desc limit 200`,
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});
