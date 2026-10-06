import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { ah, badRequest, notFound, requireFields, str } from '../lib/http.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

const COLS = 'id, name, email, role, active, created_at';

router.get('/', ah(async (req, res) => {
  const { rows } = await query(`SELECT ${COLS} FROM users ORDER BY name`);
  res.json({ users: rows });
}));

router.post('/', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre', email: 'El email', password: 'La contraseña' });
  if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres.');
  const role = req.body.role === 'admin' ? 'admin' : 'operador';
  const hash = await bcrypt.hash(String(req.body.password), 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
    [str(req.body.name), str(req.body.email).toLowerCase(), hash, role]
  );
  res.status(201).json({ user: rows[0] });
}));

router.put('/:id', ah(async (req, res) => {
  requireFields(req.body, { name: 'El nombre', email: 'El email' });
  const id = Number(req.params.id);
  const role = req.body.role === 'admin' ? 'admin' : 'operador';
  const active = req.body.active !== false;
  if (id === req.user.id && (role !== 'admin' || !active)) {
    throw badRequest('No podés quitarte el rol de administrador ni desactivarte.');
  }
  const { rows } = await query(
    `UPDATE users SET name = $2, email = $3, role = $4, active = $5 WHERE id = $1 RETURNING ${COLS}`,
    [id, str(req.body.name), str(req.body.email).toLowerCase(), role, active]
  );
  if (!rows[0]) throw notFound();
  if (req.body.password) {
    if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres.');
    await query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, await bcrypt.hash(String(req.body.password), 10)]);
    await query('DELETE FROM sessions WHERE user_id = $1', [id]);
  }
  if (!active) await query('DELETE FROM sessions WHERE user_id = $1', [id]);
  res.json({ user: rows[0] });
}));

router.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw badRequest('No podés eliminar tu propio usuario.');
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
}));

export default router;
