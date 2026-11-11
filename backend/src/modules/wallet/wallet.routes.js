import { Router } from 'express';
import * as c from './wallet.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';

const router = Router();

// ── Admin (static routes first) ───────────────────────────
router.get('/admin/overview',                      requireAuth, requireRole(ROLES.ADMIN), c.adminOverviewHandler);
router.get('/admin/wallets',                       requireAuth, requireRole(ROLES.ADMIN), c.adminListWalletsHandler);
router.get('/admin/user/:userId',              requireAuth, requireRole(ROLES.ADMIN), c.adminGetUserWallet);
router.post('/admin/adjust',                   requireAuth, requireRole(ROLES.ADMIN), c.adminAdjustHandler);
router.get('/admin/user/:userId/transactions', requireAuth, requireRole(ROLES.ADMIN), c.adminListTransactionsHandler);

// ── User wallet ───────────────────────────────────────────
router.get('/',             requireAuth, c.getMyWallet);
router.post('/top-up',      requireAuth, c.topUpHandler);
router.post('/withdraw',    requireAuth, c.withdrawHandler);
router.get('/transactions', requireAuth, c.myTransactionsHandler);

// ── Saved payment methods ─────────────────────────────────
router.get('/payment-methods',              requireAuth, c.listPaymentMethodsHandler);
router.post('/payment-methods',             requireAuth, c.addPaymentMethodHandler);
router.delete('/payment-methods/:id',       requireAuth, c.deletePaymentMethodHandler);
router.patch('/payment-methods/:id/default', requireAuth, c.setDefaultPaymentMethodHandler);

export default router;
