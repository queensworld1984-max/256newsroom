const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`select id, coalesce(display_name,name) as name, slug, parent_category_id,
      description, display_order, category_kind from categories where is_active order by display_order, name`);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/navigation', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      select p.id, coalesce(p.display_name,p.name) as display_name, p.slug, p.description,
        p.display_order, p.category_kind,
        coalesce(json_agg(json_build_object('id',c.id,'displayName',coalesce(c.display_name,c.name),'slug',c.slug,'displayOrder',c.display_order)
          order by c.display_order) filter (where c.id is not null), '[]') as children
      from categories p left join categories c on c.parent_category_id=p.id and c.is_active and c.dropdown_visibility
      where p.is_active and p.navbar_visibility and p.parent_category_id is null
      group by p.id order by p.display_order`);
    res.json({ items: rows, districts: { displayName: 'Districts', slug: 'districts' } });
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
