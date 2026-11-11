import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const poolConfig = env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[pg] Unexpected pool error:', err);
});

export const query = (text, params) => pool.query(text, params);

/**
 * Probes the DB with a trivial SELECT so startup fails fast when unreachable.
 * Throws on failure — caller is responsible for exiting the process.
 */
export async function connectAndVerify() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
