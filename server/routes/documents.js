import { Router } from 'express';
import { query, tx } from '../db/pool.js';
import { ah, badRequest, conflict, intOrNull, notFound, num, paging, str } from '../lib/http.js';
import { applyMovement, round2, round3 } from '../lib/stock.js';
import { getSettings } from '../lib/settings.js';
import { DOC_PREFIX, REASONS } from '../lib/constants.js';

const router = Router();

const LIST_SELECT = `
  SELECT d.*, s.name AS supplier_name, u.name AS created_by_name,
         (SELECT count(*)::int FROM document_items i WHERE i.document_id = d.id) AS item_count
    FROM documents d
    LEFT JOIN suppliers s ON s.id = d.supplier_id
    LEFT JOIN users u ON u.id = d.created_by`;

router.get('/', ah(async (req, res) => {
  const { page, pageSize, offset } = paging(req);
  const where = [];
  const params = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replaceAll('$?', `$${params.length}`));
  };
  if (['ingreso', 'egreso'].includes(req.query.type)) add('d.type = $?', req.query.type);
  if (['draft', 'confirmed', 'cancelled'].includes(req.query.status)) add('d.status = $?', req.query.status);
  if (str(req.query.reason)) add('d.reason = $?', str(req.query.reason));
  if (intOrNull(req.query.supplier_id)) add('d.supplier_id = $?', intOrNull(req.query.supplier_id));
  if (str(req.query.from)) add('d.date >= $?::date', str(req.query.from));
  if (str(req.query.to)) add('d.date <= $?::date', str(req.query.to));
  if (str(req.query.q)) {
    add(`(d.number ILIKE '%' || $? || '%' OR d.reference ILIKE '%' || $? || '%' OR s.name ILIKE '%' || $? || '%')`, str(req.query.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [list, count] = await Promise.all([
    query(`${LIST_SELECT} ${w} ORDER BY d.date DESC, d.id DESC LIMIT ${pageSize} OFFSET ${offset}`, params),
    query(`SELECT count(*)::int AS n FROM documents d LEFT JOIN suppliers s ON s.id = d.supplier_id ${w}`, params),
  ]);
  res.json({ documents: list.rows, total: count.rows[0].n, page, pageSize });
}));

router.get('/:id', ah(async (req, res) => {
  res.json({ document: await loadDocument(req.params.id) });
}));

router.post('/', ah(async (req, res) => {
  const data = parseDocument(req.body);
  const id = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO documents (type, reason, supplier_id, date, reference, notes, created_by)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7) RETURNING id`,
      [data.type, data.reason, data.supplierId, data.date, data.reference, data.notes, req.user.id]
    );
    const docId = rows[0].id;
    await client.query(
      `UPDATE documents SET number = $2 || '-' || lpad(id::text, 6, '0') WHERE id = $1`,
      [docId, DOC_PREFIX[data.type]]
    );
    await saveItems(client, docId, data.items);
    if (req.body.confirm) await confirmDocument(client, docId, req.user.id);
    return docId;
  });
  res.status(201).json({ document: await loadDocument(id) });
}));

router.put('/:id', ah(async (req, res) => {
  await tx(async (client) => {
    const doc = await lockDocument(client, req.params.id);
    if (doc.status !== 'draft') throw conflict('Solo se pueden editar documentos en borrador.');
    const data = parseDocument({ ...req.body, type: doc.type });
    await client.query(
      `UPDATE documents SET reason = $2, supplier_id = $3, date = COALESCE($4::date, date), reference = $5,
              notes = $6, updated_at = now() WHERE id = $1`,
      [doc.id, data.reason, data.supplierId, data.date, data.reference, data.notes]
    );
    await client.query('DELETE FROM document_items WHERE document_id = $1', [doc.id]);
    await saveItems(client, doc.id, data.items);
    if (req.body.confirm) await confirmDocument(client, doc.id, req.user.id);
  });
  res.json({ document: await loadDocument(req.params.id) });
}));

router.delete('/:id', ah(async (req, res) => {
  await tx(async (client) => {
    const doc = await lockDocument(client, req.params.id);
    if (doc.status !== 'draft') throw conflict('Solo se pueden eliminar borradores. Los confirmados se anulan.');
    await client.query('DELETE FROM documents WHERE id = $1', [doc.id]);
  });
  res.json({ ok: true });
}));

router.post('/:id/confirm', ah(async (req, res) => {
  await tx((client) => confirmDocument(client, req.params.id, req.user.id));
  res.json({ document: await loadDocument(req.params.id) });
}));

router.post('/:id/cancel', ah(async (req, res) => {
  const settings = await getSettings();
  await tx(async (client) => {
    const doc = await lockDocument(client, req.params.id);
    if (doc.status === 'cancelled') throw conflict('El documento ya está anulado.');

    if (doc.status === 'confirmed') {
      // Revierte cada renglón: un ingreso anulado resta stock, un egreso anulado lo devuelve.
      const sign = doc.type === 'ingreso' ? -1 : 1;
      const { rows: items } = await client.query(
        'SELECT * FROM document_items WHERE document_id = $1 ORDER BY id', [doc.id]
      );
      for (const item of items) {
        await applyMovement(client, {
          productId: item.product_id,
          delta: sign * Number(item.quantity),
          type: 'anulacion',
          documentId: doc.id,
          reason: `Anulación ${doc.number}`,
          notes: str(req.body?.notes),
          unitCost: item.unit_cost,
          userId: req.user.id,
          allowNegative: settings.allow_negative_stock,
        });
      }
    }
    await client.query(
      `UPDATE documents SET status = 'cancelled', cancelled_at = now(), updated_at = now(),
              notes = CASE WHEN $2::text IS NULL THEN notes ELSE concat_ws(E'\n', notes, 'Anulación: ' || $2) END
        WHERE id = $1`,
      [doc.id, str(req.body?.notes)]
    );
  });
  res.json({ document: await loadDocument(req.params.id) });
}));

// ---------- helpers ----------

function parseDocument(body) {
  const type = body.type;
  if (!REASONS[type]) throw badRequest('Tipo de documento inválido.');
  const reason = body.reason in REASONS[type] ? body.reason : null;
  if (!reason) throw badRequest('Seleccioná un motivo válido.');
  const items = Array.isArray(body.items) ? body.items : [];
  const parsed = items.map((it, i) => {
    const productId = intOrNull(it.product_id);
    const quantity = round3(num(it.quantity));
    if (!productId) throw badRequest(`Renglón ${i + 1}: falta el producto.`);
    if (!(quantity > 0)) throw badRequest(`Renglón ${i + 1}: la cantidad debe ser mayor a 0.`);
    const expiry = str(it.expiry_date);
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw badRequest(`Renglón ${i + 1}: fecha de vencimiento inválida.`);
    return {
      productId,
      quantity,
      unitCost: Math.max(0, round2(num(it.unit_cost))),
      lot: str(it.lot),
      expiryDate: type === 'ingreso' ? expiry : null,
    };
  });
  const date = str(body.date);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Fecha inválida.');
  return {
    type,
    reason,
    supplierId: intOrNull(body.supplier_id),
    date,
    reference: str(body.reference),
    notes: str(body.notes),
    items: parsed,
  };
}

async function saveItems(client, docId, items) {
  for (const it of items) {
    await client.query(
      `INSERT INTO document_items (document_id, product_id, quantity, unit_cost, lot, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [docId, it.productId, it.quantity, it.unitCost, it.lot, it.expiryDate]
    );
  }
  await updateTotal(client, docId);
}

async function updateTotal(client, docId) {
  await client.query(
    `UPDATE documents SET total = COALESCE((SELECT sum(round(quantity * unit_cost, 2)) FROM document_items WHERE document_id = $1), 0)
      WHERE id = $1`,
    [docId]
  );
}

async function lockDocument(client, id) {
  const { rows } = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw notFound('Documento no encontrado.');
  return rows[0];
}

async function confirmDocument(client, id, userId) {
  const doc = await lockDocument(client, id);
  if (doc.status !== 'draft') throw conflict('Solo se pueden confirmar documentos en borrador.');
  const settings = await getSettings(client);
  const { rows: items } = await client.query(
    `SELECT i.*, p.cost AS product_cost, p.active
       FROM document_items i JOIN products p ON p.id = i.product_id
      WHERE i.document_id = $1 ORDER BY i.id`,
    [doc.id]
  );
  if (!items.length) throw badRequest('El documento no tiene productos.');

  for (const item of items) {
    const qty = Number(item.quantity);
    if (doc.type === 'ingreso') {
      await applyMovement(client, {
        productId: item.product_id, delta: qty, type: 'ingreso', documentId: doc.id,
        reason: REASONS.ingreso[doc.reason], unitCost: item.unit_cost, userId,
        allowNegative: true,
      });
      if (doc.reason === 'compra' && settings.update_cost_on_purchase && Number(item.unit_cost) > 0) {
        await client.query('UPDATE products SET cost = $2 WHERE id = $1', [item.product_id, item.unit_cost]);
      }
    } else {
      // Valorizamos el egreso al costo vigente si no se cargó uno.
      if (!(Number(item.unit_cost) > 0)) {
        await client.query('UPDATE document_items SET unit_cost = $2 WHERE id = $1', [item.id, item.product_cost]);
      }
      await applyMovement(client, {
        productId: item.product_id, delta: -qty, type: 'egreso', documentId: doc.id,
        reason: REASONS.egreso[doc.reason], unitCost: Number(item.unit_cost) > 0 ? item.unit_cost : item.product_cost,
        userId, allowNegative: settings.allow_negative_stock,
      });
    }
  }
  await updateTotal(client, doc.id);
  await client.query(
    `UPDATE documents SET status = 'confirmed', confirmed_at = now(), updated_at = now() WHERE id = $1`,
    [doc.id]
  );
}

async function loadDocument(id) {
  const { rows } = await query(`${LIST_SELECT} WHERE d.id = $1`, [id]);
  if (!rows[0]) throw notFound('Documento no encontrado.');
  const { rows: items } = await query(
    `SELECT i.*, p.name AS product_name, p.sku, p.barcode, p.unit, p.stock AS current_stock, p.cost AS product_cost
       FROM document_items i JOIN products p ON p.id = i.product_id
      WHERE i.document_id = $1 ORDER BY i.id`,
    [id]
  );
  return { ...rows[0], items };
}

export default router;
