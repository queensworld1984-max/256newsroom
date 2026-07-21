const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('select id, name, slug from categories order by name');
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/districts', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('select id, name, slug, region from districts order by name');
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
