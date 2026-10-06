import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, notFound, requireFields, str } from '../lib/http.js';

const router = Router();
const FIELDS = ['name', 'cuit', 'contact', 'phone', 'email', 'address', 'notes'];

router.get('/', ah(async (req, res) => {
  const q = str(req.query.q);
  const { rows } = await query(
    `SELECT s.*, count(p.id)::int AS product_count,
            count(p.id) FILTER (WHERE p.active AND p.stock <= p.min_stock)::int AS low_count
       FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.id
      WHERE ($1::text IS NULL OR s.name ILIKE '%' || $1 || '%' OR s.cuit ILIKE '%' || $1 || '%' OR s.contact ILIKE '%' || $1 || '%')
      GROUP BY s.id ORDER BY s.name`,
    [q]
  );
  res.json({ suppliers: rows });
}));

router.post('/', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre' });
  const { rows } = await query(
    `INSERT INTO suppliers (${FIELDS.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    FIELDS.map((f) => str(req.body[f]))
  );
  res.status(201).json({ supplier: rows[0] });
}));

router.put('/:id', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre' });
  const sets = FIELDS.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const { rows } = await query(
    `UPDATE suppliers SET ${sets} WHERE id = $1 RETURNING *`,
    [req.params.id, ...FIELDS.map((f) => str(req.body[f]))]
  );
  if (!rows[0]) throw notFound();
  res.json({ supplier: rows[0] });
}));

router.delete('/:id', ah(async (req, res) => {
  const { rowCount } = await query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
}));

export default router;
