import { query } from '../db/pool.js';
import { HttpError } from '../lib/http.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = $1 AND s.expires_at > now() AND u.active`,
      [token]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Sesión expirada' });
    req.user = rows[0];
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Solo administradores.'));
  next();
}
