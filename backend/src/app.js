import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRouter from './modules/auth/auth.routes.js';
import techniciansRouter from './modules/technicians/technicians.routes.js';
import bookingsRouter from './modules/bookings/bookings.routes.js';
import reviewsRouter from './modules/reviews/reviews.routes.js';
import marketplaceRouter from './modules/marketplace/marketplace.routes.js';
import supportRouter from './modules/support/support.routes.js';
import walletRouter from './modules/wallet/wallet.routes.js';
import promoRouter from './modules/promo/promo.routes.js';
import usersRouter from './modules/users/users.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import { registerNotificationListeners } from './events/notification.listeners.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

export function createApp() {
  const app = express();
  
  // Register event listeners for event-driven architecture
  registerNotificationListeners();

  // Core middleware
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static file serving for uploads
  app.use('/uploads', express.static(path.join(PROJECT_ROOT, env.UPLOAD_DIR)));

  // /api router
  const api = express.Router();

  // Health check — required in Step 1
  api.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Feature modules
  api.use('/auth', authRouter);
  api.use('/technicians', techniciansRouter);
  api.use('/bookings', bookingsRouter);
  api.use('/reviews', reviewsRouter);
  api.use('/marketplace', marketplaceRouter);
  api.use('/support', supportRouter);
  api.use('/wallet', walletRouter);
  api.use('/promo', promoRouter);
  api.use('/users', usersRouter);
  api.use('/notifications', notificationsRouter);

  // ── Future feature mount points (to be added in later steps) ──
  // api.use('/ai',           aiRouter);

  app.use('/api', api);

  // 404 + centralized error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
