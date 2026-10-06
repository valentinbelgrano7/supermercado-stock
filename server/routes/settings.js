import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah, badRequest, num, str } from '../lib/http.js';
import { requireAdmin } from '../middleware/auth.js';
import { getSettings } from '../lib/settings.js';
import { REASONS } from '../lib/constants.js';

const router = Router();

router.get('/', ah(async (req, res) => {
  res.json({ settings: await getSettings(), reasons: REASONS });
}));

router.put('/', requireAdmin, ah(async (req, res) => {
  const b = req.body;
  const businessName = str(b.business_name);
  if (!businessName) throw badRequest('El nombre del negocio es obligatorio.');
  const timezone = str(b.timezone) || 'America/Argentina/Buenos_Aires';
  try {
    new Intl.DateTimeFormat('es-AR', { timeZone: timezone });
  } catch {
    throw badRequest('Zona horaria inválida.');
  }
  const currency = (str(b.currency) || 'ARS').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest('Moneda inválida (código ISO de 3 letras).');

  const { rows } = await query(
    `UPDATE settings SET business_name = $1, cuit = $2, address = $3, currency = $4, timezone = $5,
            expiry_alert_days = $6, allow_negative_stock = $7, update_cost_on_purchase = $8, updated_at = now()
      WHERE id = 1 RETURNING *`,
    [
      businessName, str(b.cuit), str(b.address), currency, timezone,
      Math.max(1, Math.round(num(b.expiry_alert_days, 30))),
      Boolean(b.allow_negative_stock), b.update_cost_on_purchase !== false,
    ]
  );
  res.json({ settings: rows[0] });
}));

export default router;
