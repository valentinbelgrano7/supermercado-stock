import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, intOrNull, paging, str } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';
import { sendWorkbook } from './products.js';

const router = Router();

async function buildQuery(q) {
  const { timezone } = await getSettings();
  const where = [];
  const params = [timezone];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replaceAll('$?', `$${params.length}`));
  };
  if (['ingreso', 'egreso', 'ajuste', 'anulacion'].includes(q.type)) add('m.type = $?', q.type);
  if (intOrNull(q.product_id)) add('m.product_id = $?', intOrNull(q.product_id));
  if (intOrNull(q.category_id)) add('p.category_id = $?', intOrNull(q.category_id));
  if (str(q.from)) add('(m.created_at AT TIME ZONE $1)::date >= $?::date', str(q.from));
  if (str(q.to)) add('(m.created_at AT TIME ZONE $1)::date <= $?::date', str(q.to));
  if (str(q.q)) add(`(p.name ILIKE '%' || $? || '%' OR p.sku ILIKE $? || '%' OR p.barcode = $? OR d.number ILIKE '%' || $? || '%')`, str(q.q));
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `
      FROM stock_movements m
      JOIN products p ON p.id = m.product_id
      LEFT JOIN documents d ON d.id = m.document_id
      LEFT JOIN users u ON u.id = m.user_id ${w}`;
  return { from, params };
}

router.get('/', ah(async (req, res) => {
  const { page, pageSize, offset } = paging(req);
  const { from, params } = await buildQuery(req.query);
  const [list, count] = await Promise.all([
    query(
      `SELECT m.*, p.name AS product_name, p.sku, p.unit, d.number AS document_number, d.type AS document_type, u.name AS user_name, $1::text AS tz
       ${from} ORDER BY m.created_at DESC, m.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    ),
    query(`SELECT count(*)::int AS n, max($1::text) AS tz ${from}`, params),
  ]);
  res.json({ movements: list.rows, total: count.rows[0].n, page, pageSize });
}));

const TYPE_LABEL = { ingreso: 'Ingreso', egreso: 'Egreso', ajuste: 'Ajuste', anulacion: 'Anulación' };

router.get('/export', ah(async (req, res) => {
  const { from, params } = await buildQuery(req.query);
  const { rows } = await query(
    `SELECT to_char(m.created_at AT TIME ZONE $1, 'DD/MM/YYYY HH24:MI') AS fecha, m.*, p.name AS product_name, p.sku, p.unit,
            d.number AS document_number, u.name AS user_name
     ${from} ORDER BY m.created_at DESC, m.id DESC LIMIT 50000`,
    params
  );
  sendWorkbook(res, rows.map((m) => ({
    Fecha: m.fecha,
    Tipo: TYPE_LABEL[m.type],
    SKU: m.sku,
    Producto: m.product_name,
    Cantidad: m.quantity,
    Unidad: m.unit,
    'Stock resultante': m.stock_after,
    'Costo unitario': m.unit_cost,
    Documento: m.document_number || '',
    Motivo: m.reason || '',
    Notas: m.notes || '',
    Usuario: m.user_name || '',
  })), 'Movimientos', `movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}));

export default router;
