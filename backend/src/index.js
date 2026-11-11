import { env } from './config/env.js';
import { connectAndVerify, pool } from './config/db.js';
import { createApp } from './app.js';

async function bootstrap() {
  // 1. Verify DB is reachable — fail fast otherwise
  try {
    await connectAndVerify();
    console.log('✅ PostgreSQL connection verified');
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // 2. Build and start Express
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 FixItAI backend running on http://localhost:${env.PORT}`);
    console.log(`   Health:  http://localhost:${env.PORT}/api/health`);
    console.log(`   Env:     ${env.NODE_ENV}`);
  });

  // 3. Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close(async () => {
      await pool.end().catch(() => {});
      console.log('PG pool closed. Goodbye.');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
