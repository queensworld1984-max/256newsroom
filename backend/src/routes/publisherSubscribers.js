const express = require('express');
const pool = require('../db');
const { requireAuth, requireOrgAccess } = require('../auth');

const router = express.Router({ mergeParams: true });

// Mounted under /api/publishers/:orgId — auth + org access applied by parent prefix usage.
// We'll attach requireAuth/requireOrgAccess on each route for safety.

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

// GET /api/publishers/:orgId/subscribers
router.get('/:orgId(\\d+)/subscribers', requireAuth, requireOrgAccess('orgId'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select s.id, s.user_id, s.email, s.display_name, s.active, s.source, s.subscribed_at,
              u.email as user_email, u.display_name as user_display_name
       from publisher_subscribers s
       left join users u on u.id = s.user_id
       where s.organization_id = $1
       order by s.active desc, s.subscribed_at desc
       limit 1000`,
      [req.params.orgId],
    );
    const active = rows.filter((r) => r.active).length;
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email || r.user_email,
        displayName: r.display_name || r.user_display_name || (r.email || r.user_email || '').split('@')[0],
        active: r.active,
        source: r.source,
        subscribedAt: r.subscribed_at,
      })),
      activeCount: active,
      totalCount: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/publishers/:orgId/broadcasts
router.get('/:orgId(\\d+)/broadcasts', requireAuth, requireOrgAccess('orgId'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select b.*, a.title as article_title, a.slug as article_slug, a.internal_url as article_internal_url
       from publisher_broadcasts b
       left join articles a on a.id = b.article_id
       where b.organization_id = $1
       order by b.created_at desc
       limit 100`,
      [req.params.orgId],
    );
    res.json({
      items: rows.map((b) => ({
        id: b.id,
        kind: b.kind,
        subject: b.subject,
        body: b.body,
        articleId: b.article_id,
        articleTitle: b.article_title,
        linkUrl: b.link_url
          || (b.article_internal_url
            ? `https://256newsroom.com${b.article_internal_url}`
            : (b.article_slug ? `https://256newsroom.com/news/${b.article_slug}` : null)),
        recipientCount: b.recipient_count,
        sentAt: b.sent_at,
        createdAt: b.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/publishers/:orgId/broadcasts — send update to all active subscribers
router.post('/:orgId(\\d+)/broadcasts', requireAuth, requireOrgAccess('orgId'), async (req, res, next) => {
  try {
    const subject = String(req.body.subject || '').trim().slice(0, 300);
    const body = String(req.body.body || '').trim().slice(0, 20000);
    if (subject.length < 3) return res.status(400).json({ error: 'Subject is required.' });
    if (body.length < 5) return res.status(400).json({ error: 'Message body is required.' });

    let kind = String(req.body.kind || 'update').toLowerCase();
    if (!['article', 'press_release', 'update', 'newsletter'].includes(kind)) kind = 'update';

    let articleId = req.body.articleId ? Number(req.body.articleId) : null;
    let linkUrl = req.body.linkUrl ? String(req.body.linkUrl).trim().slice(0, 1000) : null;

    if (articleId) {
      const { rows: arts } = await pool.query(
        `select id, title, slug, internal_url from articles
         where id = $1 and organization_id = $2 and status = 'published' and hidden = false`,
        [articleId, req.params.orgId],
      );
      if (!arts.length) return res.status(400).json({ error: 'Article not found for this publisher.' });
      if (!linkUrl) {
        linkUrl = arts[0].internal_url
          ? `https://256newsroom.com${arts[0].internal_url}`
          : `https://256newsroom.com/news/${arts[0].slug}`;
      }
      if (kind === 'update') kind = 'article';
    }

    const { rows: subs } = await pool.query(
      `select s.id, s.user_id, s.email, u.email as user_email
       from publisher_subscribers s
       left join users u on u.id = s.user_id
       where s.organization_id = $1 and s.active = true`,
      [req.params.orgId],
    );

    if (!subs.length) {
      return res.status(400).json({ error: 'No active subscribers yet. People must subscribe to your updates first.' });
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows: bRows } = await client.query(
        `insert into publisher_broadcasts
          (organization_id, created_by_user_id, kind, subject, body, article_id, link_url, recipient_count, sent_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8, now())
         returning *`,
        [
          req.params.orgId,
          req.user.id,
          kind,
          subject,
          body,
          articleId,
          linkUrl,
          subs.length,
        ],
      );
      const broadcast = bRows[0];

      for (const sub of subs) {
        const email = sub.email || sub.user_email || null;
        // Registered users get an in-app inbox delivery; email-only are queued.
        const status = sub.user_id ? 'inbox' : 'queued';
        await client.query(
          `insert into publisher_broadcast_deliveries
            (broadcast_id, subscriber_id, user_id, email, status)
           values ($1,$2,$3,$4,$5)`,
          [broadcast.id, sub.id, sub.user_id || null, email, status],
        );
      }

      await client.query('commit');
      res.status(201).json({
        ok: true,
        item: {
          id: broadcast.id,
          kind: broadcast.kind,
          subject: broadcast.subject,
          body: broadcast.body,
          articleId: broadcast.article_id,
          linkUrl: broadcast.link_url,
          recipientCount: broadcast.recipient_count,
          sentAt: broadcast.sent_at,
        },
        message: `Update sent to ${subs.length} subscriber${subs.length === 1 ? '' : 's'}. Registered members will see it in their inbox; email-only subscribers are queued for delivery.`,
      });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.normalizeEmail = normalizeEmail;
