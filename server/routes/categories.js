import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, notFound, requireFields, str } from '../lib/http.js';

const router = Router();

router.get('/', ah(async (req, res) => {
  const q = str(req.query.q);
  const { rows } = await query(
    `SELECT c.*, count(p.id)::int AS product_count,
            COALESCE(sum(p.stock * p.cost) FILTER (WHERE p.active AND p.stock > 0), 0)::numeric(14,2) AS stock_value
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
      WHERE ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%')
      GROUP BY c.id ORDER BY c.name`,
    [q]
  );
  res.json({ categories: rows });
}));

router.post('/', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre' });
  const { rows } = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [str(req.body.name)]);
  res.status(201).json({ category: rows[0] });
}));

router.put('/:id', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre' });
  const { rows } = await query('UPDATE categories SET name = $2 WHERE id = $1 RETURNING *', [req.params.id, str(req.body.name)]);
  if (!rows[0]) throw notFound();
  res.json({ category: rows[0] });
}));

router.delete('/:id', ah(async (req, res) => {
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
}));

export default router;
