const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/me/notifications?limit=&unreadOnly=
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const unreadOnly = String(req.query.unreadOnly || '') === '1'
      || String(req.query.unreadOnly || '').toLowerCase() === 'true';

    const params = [req.user.id];
    let where = 'user_id = $1';
    if (unreadOnly) where += ' and read_at is null';

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `select id, kind, title, body, href, organization_id, meta, read_at, created_at
         from user_notifications
         where ${where}
         order by created_at desc
         limit ${limit}`,
        params,
      ),
      pool.query(
        `select count(*)::int as c from user_notifications
         where user_id = $1 and read_at is null`,
        [req.user.id],
      ),
    ]);

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        organizationId: r.organization_id,
        meta: r.meta,
        readAt: r.read_at,
        createdAt: r.created_at,
        unread: !r.read_at,
      })),
      unreadCount: countRows[0].c,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/me/notifications/unread-count
router.get('/notifications/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select count(*)::int as c from user_notifications
       where user_id = $1 and read_at is null`,
      [req.user.id],
    );
    res.json({ unreadCount: rows[0].c });
  } catch (err) {
    next(err);
  }
});

// POST /api/me/notifications/:id/read
router.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `update user_notifications set read_at = now()
       where id = $1 and user_id = $2 and read_at is null
       returning id, read_at`,
      [req.params.id, req.user.id],
    );
    res.json({ ok: true, item: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// POST /api/me/notifications/read-all
router.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `update user_notifications set read_at = now()
       where user_id = $1 and read_at is null`,
      [req.user.id],
    );
    res.json({ ok: true, marked: rowCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
