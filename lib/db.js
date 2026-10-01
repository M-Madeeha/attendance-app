import { Pool } from 'pg';

let pool;

if (!global.pgPool) {
  global.pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });
}
pool = global.pgPool;

export function databaseErrorMessage(error) {
  const detail = Array.isArray(error?.errors)
    ? error.errors.map((item) => item?.message).filter(Boolean).join('; ')
    : '';
  if (detail) return `Could not reach the database. ${detail}`;
  if (error?.message) return error.message;
  return 'Could not reach the database. Check that Postgres is running and DATABASE_URL is set.';
}

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}