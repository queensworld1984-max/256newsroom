const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../auth');
const core = require('../storiesCore');

const router = express.Router();

router.use(requireAuth, requireRole('independent_journalist', 'super_admin', 'newsroom_admin'));

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select * from articles where created_by_user_id = $1 and organization_id is null order by updated_at desc limit 100',
      [req.user.id],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = core.pickStoryInput(req.body);
    const { rows: journalistRows } = await pool.query(
      'select id from journalists where user_id = $1',
      [req.user.id],
    );
    const journalistId = journalistRows[0]?.id || null;

    let story = await core.createStory({
      organizationId: null,
      journalistId,
      createdByUserId: req.user.id,
      input,
    });
    // Independent journalists may publish immediately (no admin / org gate).
    if (req.body.publish === true || req.body.publish === 'true') {
      story = await core.publishStory(story.id);
    }
    res.status(201).json({ item: story });
  } catch (err) {
    next(err);
  }
});

async function loadOwnStory(req, res, next) {
  const { rows } = await pool.query(
    'select * from articles where id = $1 and created_by_user_id = $2 and organization_id is null',
    [req.params.id, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Story not found.' });
  req.story = rows[0];
  next();
}

router.get('/:id', loadOwnStory, (req, res) => res.json({ item: req.story }));

router.patch('/:id', loadOwnStory, async (req, res, next) => {
  try {
    const input = core.pickStoryInput(req.body);
    let updated = await core.updateStory(req.story.id, input);
    if (req.body.publish === true || req.body.publish === 'true') {
      updated = await core.publishStory(req.story.id);
    }
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/publish', loadOwnStory, async (req, res, next) => {
  try {
    const updated = await core.publishStory(req.story.id);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/schedule', loadOwnStory, async (req, res, next) => {
  try {
    const at = req.body.scheduledPublishAt ? new Date(req.body.scheduledPublishAt) : null;
    if (!at || Number.isNaN(at.getTime())) {
      return res.status(400).json({ error: 'A valid scheduledPublishAt is required.' });
    }
    const updated = await core.scheduleStory(req.story.id, at);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/withdraw', loadOwnStory, async (req, res, next) => {
  try {
    const updated = await core.withdrawStory(req.story.id, req.body.reason);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
