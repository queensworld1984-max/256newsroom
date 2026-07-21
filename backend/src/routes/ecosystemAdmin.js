const express = require('express');
const pool = require('../db');
const { requireRole } = require('../auth');
const { discoverSource, DomainNotApprovedError } = require('../contentDiscovery');
const { runGenerationJob } = require('../ecosystemGenerate');

const router = express.Router();
router.use(requireRole('super_admin', 'newsroom_admin'));

router.get('/platforms', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select o.id, o.name, o.slug, o.website_url, o.logo_url, o.parent_organization_id,
        s.mode, s.daily_target, s.daily_max, s.publish_times, s.active_days, s.timezone,
        s.min_interval_minutes, s.content_rotation, s.eligible_content_types
      from organizations o
      join automation_settings s on s.organization_id = o.id
      where o.org_type = 'ecosystem_platform'
      order by o.name
    `);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/platforms/:orgId(\\d+)/settings', async (req, res, next) => {
  try {
    const allowed = {
      mode: 'mode', dailyTarget: 'daily_target', dailyMax: 'daily_max',
      publishTimes: 'publish_times', activeDays: 'active_days', timezone: 'timezone',
      minIntervalMinutes: 'min_interval_minutes', contentRotation: 'content_rotation',
      eligibleContentTypes: 'eligible_content_types',
    };
    if (req.body.mode !== undefined && !['automatic', 'draft', 'manual', 'paused'].includes(req.body.mode)) {
      return res.status(400).json({ error: "mode must be one of: automatic, draft, manual, paused." });
    }
    const sets = [];
    const values = [];
    let i = 1;
    for (const [key, column] of Object.entries(allowed)) {
      if (req.body[key] === undefined) continue;
      const jsonColumns = new Set(['publish_times', 'active_days', 'content_rotation', 'eligible_content_types']);
      sets.push(`${column} = $${i}`);
      values.push(jsonColumns.has(column) ? JSON.stringify(req.body[key]) : req.body[key]);
      i += 1;
    }
    if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided.' });
    sets.push('updated_at = now()');
    values.push(req.params.orgId);
    const { rows } = await pool.query(
      `update automation_settings set ${sets.join(', ')} where organization_id = $${i} returning *`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: 'Platform not found.' });
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/platforms/:orgId(\\d+)/domains', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from approved_domains where organization_id = $1 order by created_at desc', [req.params.orgId]);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/platforms/:orgId(\\d+)/domains', async (req, res, next) => {
  try {
    const domain = String(req.body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return res.status(400).json({ error: 'A domain is required.' });
    const { rows } = await pool.query(
      `insert into approved_domains (organization_id, domain, added_by_user_id)
       values ($1, $2, $3) on conflict (organization_id, domain) do update set active = true
       returning *`,
      [req.params.orgId, domain, req.user.id],
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/platforms/:orgId(\\d+)/domains/:id', async (req, res, next) => {
  try {
    await pool.query('delete from approved_domains where id = $1 and organization_id = $2', [req.params.id, req.params.orgId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/platforms/:orgId(\\d+)/sources', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from platform_sources where organization_id = $1 order by created_at desc', [req.params.orgId]);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/platforms/:orgId(\\d+)/sources', async (req, res, next) => {
  try {
    const url = String(req.body.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'A valid http(s) URL is required.' });
    const { rows } = await pool.query(
      `insert into platform_sources (organization_id, url, label, content_type_hint, added_by_user_id)
       values ($1, $2, $3, $4, $5)
       on conflict (organization_id, url) do update set active = true, label = excluded.label
       returning *`,
      [req.params.orgId, url, req.body.label || null, req.body.contentTypeHint || null, req.user.id],
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/platforms/:orgId(\\d+)/sources/:id', async (req, res, next) => {
  try {
    await pool.query('delete from platform_sources where id = $1 and organization_id = $2', [req.params.id, req.params.orgId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/platforms/:orgId(\\d+)/excluded-urls', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from excluded_urls where organization_id = $1 order by created_at desc', [req.params.orgId]);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/platforms/:orgId(\\d+)/excluded-urls', async (req, res, next) => {
  try {
    const pattern = String(req.body.urlPattern || '').trim();
    if (!pattern) return res.status(400).json({ error: 'A URL pattern is required.' });
    const { rows } = await pool.query(
      `insert into excluded_urls (organization_id, url_pattern, reason, added_by_user_id) values ($1, $2, $3, $4) returning *`,
      [req.params.orgId, pattern, req.body.reason || null, req.user.id],
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/platforms/:orgId(\\d+)/excluded-urls/:id', async (req, res, next) => {
  try {
    await pool.query('delete from excluded_urls where id = $1 and organization_id = $2', [req.params.id, req.params.orgId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/platforms/:orgId(\\d+)/evidence', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select id, source_url, canonical_url, source_page_title, content_hash, discovered_at, length(raw_text_snapshot) as snapshot_length from source_evidence where organization_id = $1 order by discovered_at desc limit 100',
      [req.params.orgId],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/platforms/:orgId(\\d+)/evidence/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('select * from source_evidence where id = $1 and organization_id = $2', [req.params.id, req.params.orgId]);
    if (!rows.length) return res.status(404).json({ error: 'Evidence not found.' });
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Manual/test-only discovery trigger — fetches and snapshots one source page.
// Does not call any AI model and does not create or publish an article.
router.post('/platforms/:orgId(\\d+)/discover', async (req, res, next) => {
  try {
    const url = String(req.body.url || '').trim();
    if (!url) return res.status(400).json({ error: 'A url is required.' });
    const result = await discoverSource(req.params.orgId, url);
    res.json({
      evidenceId: result.evidence.id,
      sourcePageTitle: result.evidence.source_page_title,
      contentHash: result.evidence.content_hash,
      canonicalUrl: result.evidence.canonical_url,
      isNewOrChanged: result.isNewOrChanged,
      previousEvidenceId: result.previousEvidenceId,
      renderedWithBrowser: result.renderedWithBrowser,
      snapshotLength: result.extracted.textContent.length,
      imageUrl: result.extracted.imageUrl,
      descriptionPreview: result.extracted.description,
      textPreview: result.extracted.textContent.slice(0, 600),
    });
  } catch (err) {
    if (err instanceof DomainNotApprovedError) return res.status(403).json({ error: err.message });
    res.status(502).json({ error: `Discovery failed: ${err.message}` });
  }
});

// Manual/test-only generation trigger — runs the full generate + validate
// pipeline for one already-discovered piece of evidence. Only creates an
// article if every material claim validates against the source text.
router.post('/platforms/:orgId(\\d+)/generate', async (req, res, next) => {
  try {
    const sourceEvidenceId = Number(req.body.sourceEvidenceId);
    if (!sourceEvidenceId) return res.status(400).json({ error: 'sourceEvidenceId is required.' });
    const result = await runGenerationJob({
      organizationId: req.params.orgId,
      sourceEvidenceId,
      triggeredBy: `user:${req.user.id}`,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.query.organizationId) {
      params.push(req.query.organizationId);
      where += ` and g.organization_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      where += ` and g.status = $${params.length}`;
    }
    const { rows } = await pool.query(
      `select g.*, o.name as organization_name
       from generation_jobs g
       join organizations o on o.id = g.organization_id
       where ${where}
       order by g.started_at desc limit 100`,
      params,
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
