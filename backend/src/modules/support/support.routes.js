import { Router } from 'express';
import * as c from './support.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';

const router = Router();

// ── Notifications (authenticated user) ────────────────────
router.get('/notifications',          requireAuth, c.getNotifications);
router.patch('/notifications/read-all', requireAuth, c.readAllNotifications);
router.patch('/notifications/:id/read', requireAuth, c.readNotification);

// ── Disputes ──────────────────────────────────────────────
// Any authenticated user can create a dispute
router.post('/disputes', requireAuth, c.createDisputeHandler);

// Admin — list and manage disputes
router.get('/disputes',           requireAuth, requireRole(ROLES.ADMIN), c.listDisputesHandler);
router.get('/disputes/:id',       requireAuth, requireRole(ROLES.ADMIN), c.getDisputeHandler);
router.patch('/disputes/:id/resolve', requireAuth, requireRole(ROLES.ADMIN), c.resolveDisputeHandler);

// ── Chat (AI chatbot — authenticated user) ────────────────
router.post('/chat/sessions',         requireAuth, c.createSessionHandler);
router.get('/chat/sessions',          requireAuth, c.listSessionsHandler);
router.post('/chat/sessions/:id/messages', requireAuth, c.addMessageHandler);
router.get('/chat/sessions/:id/messages',  requireAuth, c.listMessagesHandler);

export default router;
