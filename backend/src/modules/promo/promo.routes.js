import { Router } from 'express';
import * as c from './promo.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';

const router = Router();

// ── Admin (static routes first) ───────────────────────────
router.get('/admin',                  requireAuth, requireRole(ROLES.ADMIN), c.listPromosHandler);
router.post('/admin',                 requireAuth, requireRole(ROLES.ADMIN), c.createPromoHandler);
router.get('/admin/:id',              requireAuth, requireRole(ROLES.ADMIN), c.getPromoHandler);
router.put('/admin/:id',              requireAuth, requireRole(ROLES.ADMIN), c.updatePromoHandler);
router.patch('/admin/:id/deactivate', requireAuth, requireRole(ROLES.ADMIN), c.deactivatePromoHandler);
router.get('/admin/:id/stats',        requireAuth, requireRole(ROLES.ADMIN), c.getPromoStatsHandler);

// ── User: validate promo code before checkout ─────────────
router.post('/validate', requireAuth, c.validatePromoHandler);

export default router;
