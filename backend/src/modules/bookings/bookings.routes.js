import { Router } from 'express';
import * as controller from './bookings.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';

const router = Router();

// ── Static routes MUST come before /:id to avoid mis-matching ──

// Technician — list bookings assigned to the current technician
router.get('/technician', requireAuth, requireRole(ROLES.TECHNICIAN), controller.listForTechnician);

// Admin — list all bookings
router.get('/admin', requireAuth, requireRole(ROLES.ADMIN), controller.listAll);

// ── Client routes ─────────────────────────────────────────

// Create a new booking (clients only)
router.post('/', requireAuth, requireRole(ROLES.CLIENT), controller.create);

// List bookings for the current user (any authenticated user)
router.get('/', requireAuth, controller.listMine);

// ── Parameterized routes ──────────────────────────────────

// Get booking details (any authenticated user)
router.get('/:id', requireAuth, controller.getById);

// Get booking status history
router.get('/:id/history', requireAuth, controller.getHistory);

// Cancel own booking (any authenticated user — ownership enforced in service)
router.delete('/:id', requireAuth, controller.cancel);

// Client pays quotation
router.post('/:id/pay', requireAuth, requireRole(ROLES.CLIENT), controller.payQuote);

// Technician updates booking status (accept / reject / in_progress / complete)
router.patch('/:id/status', requireAuth, requireRole(ROLES.TECHNICIAN), controller.updateStatus);

// Admin overrides booking status
router.patch('/:id/admin-status', requireAuth, requireRole(ROLES.ADMIN), controller.adminUpdateStatus);

export default router;
