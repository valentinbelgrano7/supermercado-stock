import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, intOrNull } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';

const router = Router();

// Lotes con vencimiento que (estimando FIFO) siguen en stock: el stock actual se asume
// compuesto por los ingresos más recientes; un lote cuenta si los ingresos posteriores no lo cubren.
const EXPIRING_LOTS_SQL = `
  WITH today AS (SELECT (now() AT TIME ZONE $1)::date AS d),
  lots AS (
    SELECT i.id, i.product_id, i.quantity, i.lot, i.expiry_date, d.number AS document_number, d.id AS document_id,
           p.name AS product_name, p.sku, p.unit, p.stock, p.cost,
           COALESCE(sum(i.quantity) OVER (
             PARTITION BY i.product_id ORDER BY d.date DESC, i.id DESC
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS newer_qty
      FROM document_items i
      JOIN documents d ON d.id = i.document_id AND d.status = 'confirmed' AND d.type = 'ingreso'
      JOIN products p ON p.id = i.product_id AND p.active AND p.stock > 0
  )
  SELECT lots.id, lots.product_id, lots.quantity, lots.lot, lots.expiry_date, lots.document_number, lots.document_id,
         lots.product_name, lots.sku, lots.unit, lots.stock, lots.cost,
         LEAST(lots.quantity, lots.stock - lots.newer_qty) AS remaining,
         (lots.expiry_date - today.d) AS days_left
    FROM lots CROSS JOIN today
   WHERE lots.expiry_date IS NOT NULL
     AND lots.newer_qty < lots.stock
     AND lots.expiry_date <= today.d + $2::int
   ORDER BY lots.expiry_date, lots.product_name`;

// Productos a reponer: stock <= mínimo. Sugerido = llevar a 2x el mínimo.
router.get('/restock', ah(async (req, res) => {
  const supplierId = intOrNull(req.query.supplier_id);
  const { rows } = await query(
    `SELECT p.id, p.sku, p.barcode, p.name, p.unit, p.stock, p.min_stock, p.cost, p.supplier_id,
            s.name AS supplier_name, c.name AS category_name,
            GREATEST(p.min_stock * 2 - p.stock, 0) AS suggested
       FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.active AND p.min_stock > 0 AND p.stock <= p.min_stock
        AND ($1::int IS NULL OR p.supplier_id = $1)
      ORDER BY s.name NULLS LAST, (p.stock / NULLIF(p.min_stock, 0)) ASC, p.name`,
    [supplierId]
  );
  res.json({ products: rows });
}));

// Lotes con vencimiento próximo o ya vencidos que siguen en góndola.
router.get('/expiries', ah(async (req, res) => {
  const settings = await getSettings();
  const days = intOrNull(req.query.days) ?? settings.expiry_alert_days;
  const { rows } = await query(EXPIRING_LOTS_SQL, [settings.timezone, days]);
  res.json({ items: rows, days });
}));

router.get('/dashboard', ah(async (req, res) => {
  const { timezone, expiry_alert_days: expiryDays } = await getSettings();
  const tz = [timezone];

  const [stock, docs, months, low, recent, expiring, byCategory] = await Promise.all([
    query(`
      SELECT count(*) FILTER (WHERE active)::int AS active_products,
             count(*) FILTER (WHERE active AND stock <= 0)::int AS out_of_stock,
             count(*) FILTER (WHERE active AND stock > 0 AND stock <= min_stock)::int AS low_stock,
             COALESCE(sum(stock * cost) FILTER (WHERE active AND stock > 0), 0)::numeric(16,2) AS value_cost,
             COALESCE(sum(stock * price) FILTER (WHERE active AND stock > 0), 0)::numeric(16,2) AS value_price
        FROM products`),
    query(`
      WITH m AS (SELECT date_trunc('month', now() AT TIME ZONE $1)::date AS start)
      SELECT
        count(*) FILTER (WHERE d.type = 'ingreso')::int AS ingresos_count,
        COALESCE(sum(d.total) FILTER (WHERE d.type = 'ingreso'), 0)::numeric(16,2) AS ingresos_total,
        count(*) FILTER (WHERE d.type = 'egreso')::int AS egresos_count,
        COALESCE(sum(d.total) FILTER (WHERE d.type = 'egreso'), 0)::numeric(16,2) AS egresos_total,
        COALESCE(sum(d.total) FILTER (WHERE d.type = 'egreso' AND d.reason IN ('merma', 'vencimiento')), 0)::numeric(16,2) AS mermas_total
        FROM documents d, m
       WHERE d.status = 'confirmed' AND d.date >= m.start`, tz),
    query(`
      WITH months AS (
        SELECT generate_series(date_trunc('month', now() AT TIME ZONE $1) - interval '5 months',
                               date_trunc('month', now() AT TIME ZONE $1), interval '1 month')::date AS month)
      SELECT to_char(months.month, 'YYYY-MM') AS month,
             COALESCE(sum(d.total) FILTER (WHERE d.type = 'ingreso'), 0)::numeric(16,2) AS ingresos,
             COALESCE(sum(d.total) FILTER (WHERE d.type = 'egreso'), 0)::numeric(16,2) AS egresos
        FROM months
        LEFT JOIN documents d ON d.status = 'confirmed' AND date_trunc('month', d.date)::date = months.month
       GROUP BY months.month ORDER BY months.month`, tz),
    query(`
      SELECT p.id, p.name, p.sku, p.unit, p.stock, p.min_stock, s.name AS supplier_name
        FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.active AND p.min_stock > 0 AND p.stock <= p.min_stock
       ORDER BY (p.stock / NULLIF(p.min_stock, 0)) ASC, p.name LIMIT 8`),
    query(`
      SELECT m.id, m.type, m.quantity, m.created_at, m.reason, p.id AS product_id, p.name AS product_name, p.unit,
             d.number AS document_number, m.document_id
        FROM stock_movements m JOIN products p ON p.id = m.product_id
        LEFT JOIN documents d ON d.id = m.document_id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 8`),
    query(`${EXPIRING_LOTS_SQL} LIMIT 8`, [timezone, expiryDays]),
    query(`
      SELECT COALESCE(c.name, 'Sin categoría') AS name, sum(p.stock * p.cost)::numeric(16,2) AS value
        FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.active AND p.stock > 0
       GROUP BY c.name ORDER BY value DESC LIMIT 6`),
  ]);

  res.json({
    stock: stock.rows[0],
    month: docs.rows[0],
    months: months.rows,
    lowStock: low.rows,
    recentMovements: recent.rows,
    expiring: expiring.rows,
    byCategory: byCategory.rows,
    expiryDays,
  });
}));

export default router;
