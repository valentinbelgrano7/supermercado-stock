import { query } from '../db/pool.js';

export async function getSettings(client) {
  const db = client || { query };
  const { rows } = await db.query('SELECT * FROM settings WHERE id = 1');
  return rows[0];
}
