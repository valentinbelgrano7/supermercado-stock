import { badRequest, notFound } from './http.js';

const fmtQty = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 });

/**
 * Aplica un cambio de stock a un producto y lo registra en el kardex.
 * Debe llamarse dentro de una transacción (client de tx()).
 */
export async function applyMovement(client, {
  productId,
  delta,
  type,
  documentId = null,
  reason = null,
  notes = null,
  userId = null,
  unitCost = null,
  allowNegative = false,
}) {
  const { rows } = await client.query(
    'SELECT id, name, stock, cost FROM products WHERE id = $1 FOR UPDATE',
    [productId]
  );
  const product = rows[0];
  if (!product) throw notFound('Producto inexistente.');

  const after = round3(Number(product.stock) + Number(delta));
  if (after < 0 && !allowNegative) {
    throw badRequest(
      `Stock insuficiente para "${product.name}": disponible ${fmtQty(product.stock)}, se requieren ${fmtQty(-delta)}.`
    );
  }

  await client.query('UPDATE products SET stock = $2, updated_at = now() WHERE id = $1', [productId, after]);
  await client.query(
    `INSERT INTO stock_movements (product_id, type, quantity, stock_after, unit_cost, document_id, reason, notes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [productId, type, round3(delta), after, unitCost ?? product.cost, documentId, reason, notes, userId]
  );
  return { before: Number(product.stock), after };
}

export const round3 = (n) => Math.round(Number(n) * 1000) / 1000;
export const round2 = (n) => Math.round(Number(n) * 100) / 100;
