import { Router } from 'express';
import * as c from './marketplace.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';

const router = Router();

// ── Admin (static routes first) ───────────────────────────
router.get('/admin/orders',   requireAuth, requireRole(ROLES.ADMIN), c.adminListOrdersHandler);
router.get('/admin/products', requireAuth, requireRole(ROLES.ADMIN), c.adminListProductsHandler);
router.post('/admin/products',          requireAuth, requireRole(ROLES.ADMIN), c.adminCreateProductHandler);
router.put('/admin/products/:id',       requireAuth, requireRole(ROLES.ADMIN), c.adminUpdateProductHandler);
router.patch('/admin/products/:id/toggle', requireAuth, requireRole(ROLES.ADMIN), c.adminToggleProductHandler);
router.patch('/admin/orders/:id/status',   requireAuth, requireRole(ROLES.ADMIN), c.adminUpdateOrderStatusHandler);

// ── Public: products ──────────────────────────────────────
router.get('/products',     c.listProductsHandler);
router.get('/products/:id', c.getProductHandler);

// ── Cart ──────────────────────────────────────────────────
router.get('/cart',        requireAuth, c.getCartHandler);
router.post('/cart',       requireAuth, c.addToCartHandler);
router.put('/cart/:id',    requireAuth, c.updateCartHandler);
router.delete('/cart/:id', requireAuth, c.removeCartHandler);

// ── Client: orders ────────────────────────────────────────
router.post('/orders',    requireAuth, requireRole(ROLES.CLIENT), c.createOrderHandler);
router.get('/orders',     requireAuth, c.listOrdersHandler);
router.get('/orders/:id', requireAuth, c.getOrderHandler);

// ── Client: payments ──────────────────────────────────────
router.post('/payments/order',   requireAuth, c.createOrderPaymentHandler);
router.post('/payments/booking', requireAuth, c.createBookingPaymentHandler);
router.get('/payments/:id',      requireAuth, c.getPaymentHandler);

// ── Admin: refunds ────────────────────────────────────────
router.post('/payments/:id/refund', requireAuth, requireRole(ROLES.ADMIN), c.refundPaymentHandler);

export default router;
