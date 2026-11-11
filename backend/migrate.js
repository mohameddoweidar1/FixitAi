import pg from 'pg';

async function migrate() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:1111@127.0.0.1:5432/fixitai' });
  await client.connect();
  try {
    await client.query("ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'reserved', 'released', 'refunded'));");
    console.log("Migration successful");
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('Already migrated');
    } else {
      console.error(e);
    }
  }
  await client.end();
}

migrate();
