const express = require('express');
const pool = require('../db');
const { requireAuth, requireOrgAccess } = require('../auth');
const core = require('../storiesCore');

const router = express.Router();

router.use('/:orgId/stories', requireAuth, requireOrgAccess('orgId'));

router.get('/:orgId/stories', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const params = [req.params.orgId];
    let where = 'organization_id = $1';
    if (status) {
      params.push(status);
      where += ' and status = $2';
    }
    const { rows } = await pool.query(
      `select * from articles where ${where} order by updated_at desc limit 100`,
      params,
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/stories', async (req, res, next) => {
  try {
    const input = core.pickStoryInput(req.body);
    const journalistId = req.body.journalistId ? Number(req.body.journalistId) : null;
    const story = await core.createStory({
      organizationId: Number(req.params.orgId),
      journalistId,
      createdByUserId: req.user.id,
      input,
    });
    res.status(201).json({ item: story });
  } catch (err) {
    next(err);
  }
});

async function loadOwnedStory(req, res, next) {
  const { rows } = await pool.query('select * from articles where id = $1 and organization_id = $2', [req.params.id, req.params.orgId]);
  if (!rows.length) return res.status(404).json({ error: 'Story not found.' });
  req.story = rows[0];
  next();
}

router.get('/:orgId/stories/:id', loadOwnedStory, (req, res) => res.json({ item: req.story }));

router.patch('/:orgId/stories/:id', loadOwnedStory, async (req, res, next) => {
  try {
    const input = core.pickStoryInput(req.body);
    const updated = await core.updateStory(req.story.id, input);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/stories/:id/schedule', loadOwnedStory, async (req, res, next) => {
  try {
    const at = req.body.scheduledPublishAt ? new Date(req.body.scheduledPublishAt) : null;
    if (!at || Number.isNaN(at.getTime())) return res.status(400).json({ error: 'A valid scheduledPublishAt is required.' });
    const updated = await core.scheduleStory(req.story.id, at);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/stories/:id/publish', loadOwnedStory, async (req, res, next) => {
  try {
    const updated = await core.publishStory(req.story.id);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/stories/:id/withdraw', loadOwnedStory, async (req, res, next) => {
  try {
    const updated = await core.withdrawStory(req.story.id, req.body.reason);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/stories/:id/corrections', loadOwnedStory, async (req, res, next) => {
  try {
    const updated = await core.addCorrection(req.story.id, {
      note: req.body.note,
      newBody: req.body.newBody,
      newHeadline: req.body.newHeadline,
      correctedByUserId: req.user.id,
    });
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
