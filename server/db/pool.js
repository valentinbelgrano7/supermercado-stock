import 'dotenv/config';
import pg from 'pg';

// NUMERIC llega como string: lo convertimos a número para la API.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// DATE (sin hora) se devuelve tal cual, 'YYYY-MM-DD', para evitar corrimientos de zona horaria.
pg.types.setTypeParser(1082, (v) => v);

const connectionString = process.env.DATABASE_URL || 'postgres://stock:stock@localhost:5432/stock';
const useSsl = process.env.PGSSL === 'true' || /sslmode=require/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export function query(text, params) {
  return pool.query(text, params);
}

// Ejecuta fn(client) dentro de una transacción.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
