// Convenience initializer: runs the module SQL files to create/update tables.
// Usage: `npm run db:init`
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, connectAndVerify } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
  path.resolve(__dirname, '../modules/auth/auth.sql'),
  path.resolve(__dirname, '../modules/technicians/technicians.sql'),
  path.resolve(__dirname, '../modules/bookings/bookings.sql'),
  path.resolve(__dirname, '../modules/reviews/reviews.sql'),
  path.resolve(__dirname, '../modules/wallet/wallet.sql'),
  path.resolve(__dirname, '../modules/marketplace/marketplace.sql'),
  path.resolve(__dirname, '../modules/promo/promo.sql'),
  path.resolve(__dirname, '../modules/support/support.sql'),
  path.resolve(__dirname, '../modules/notifications/notifications.sql'),
];

async function run() {
  try {
    await connectAndVerify();
    console.log('✅ PostgreSQL reachable — applying SQL files...');

    for (const file of MIGRATIONS) {
      const sql = await readFile(file, 'utf8');
      await pool.query(sql);
      console.log(`   ✓ applied ${path.relative(process.cwd(), file)}`);
    }

    console.log('✅ Database initialization complete.');
  } catch (err) {
    console.error('❌ DB init failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

run();
