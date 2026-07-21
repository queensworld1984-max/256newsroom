const express = require('express');
const pool = require('../db');

const router = express.Router();

// CORS for this path is handled by the dynamic resolver in server.js
// (permissive, no credentials — this is a public read-only endpoint).
router.get('/:slug/news', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const { rows: orgRows } = await pool.query(
      `select id, name, slug, logo_url, website_url from organizations
       where slug = $1 and active = true and is_official = true and verification_status = 'approved'`,
      [req.params.slug],
    );
    const org = orgRows[0];
    if (!org) return res.status(404).json({ error: 'Unknown or unapproved platform.' });

    const { rows } = await pool.query(
      `select a.id, a.title, a.summary, a.published_at, a.slug, a.external_url, a.content_type, a.image_url
       from articles a
       where a.organization_id = $1 and a.status = 'published' and a.hidden = false
       order by a.published_at desc nulls last
       limit $2`,
      [org.id, limit],
    );

    res.set('Cache-Control', 'public, max-age=120');
    res.json({
      platform: { name: org.name, slug: org.slug, logoUrl: org.logo_url, websiteUrl: org.website_url },
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        publishedAt: row.published_at,
        contentType: row.content_type,
        imageUrl: row.image_url,
        sourceUrl: row.external_url,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
