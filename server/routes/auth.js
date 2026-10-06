import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { ah, badRequest, str } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const SESSION_DAYS = 14;
const router = Router();

router.post('/login', ah(async (req, res) => {
  const email = str(req.body.email)?.toLowerCase();
  const password = req.body.password || '';
  if (!email || !password) throw badRequest('Ingresá email y contraseña.');

  const { rows } = await query('SELECT * FROM users WHERE email = $1 AND active', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [token, user.id, String(SESSION_DAYS)]
  );
  // Limpieza oportunista de sesiones vencidas
  query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', requireAuth, ah(async (req, res) => {
  await query('DELETE FROM sessions WHERE token = $1', [req.token]);
  res.json({ ok: true });
}));

router.post('/password', requireAuth, ah(async (req, res) => {
  const { current, next } = req.body;
  if (!next || String(next).length < 6) throw badRequest('La nueva contraseña debe tener al menos 6 caracteres.');
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(current || '', rows[0].password_hash))) throw badRequest('La contraseña actual no es correcta.');
  const hash = await bcrypt.hash(String(next), 10);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
  await query('DELETE FROM sessions WHERE user_id = $1 AND token <> $2', [req.user.id, req.token]);
  res.json({ ok: true });
}));

export default router;
