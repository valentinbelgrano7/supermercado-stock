import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = await readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  await ensureAdmin();
}

async function ensureAdmin() {
  const { rows } = await query('SELECT count(*)::int AS n FROM users');
  if (rows[0].n > 0) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@super.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Administrador';
  const hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
    [name, email, hash]
  );
  console.log(`[db] usuario admin creado: ${email}`);
}

// Permite correrlo standalone: `npm run migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => console.log('[db] migración OK'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
