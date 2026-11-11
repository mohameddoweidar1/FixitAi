import { Router } from 'express';
import * as controller from './reviews.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';

const router = Router();

// ── Static / specific routes MUST come before /:id ────────

// Public — list reviews for a specific technician
router.get('/technician/:id', controller.listForTechnician);

// Admin — list all reviews
router.get('/', requireAuth, requireRole(ROLES.ADMIN), controller.listAll);

// Client — create a review for a completed booking
router.post('/', requireAuth, requireRole(ROLES.CLIENT), controller.create);

// ── Parameterized routes ──────────────────────────────────

// Client — update own review (ownership enforced in service)
router.put('/:id', requireAuth, controller.update);

// Client — delete own review (ownership enforced in service)
router.delete('/:id', requireAuth, controller.remove);

// Admin — toggle review visibility
router.patch('/:id/visibility', requireAuth, requireRole(ROLES.ADMIN), controller.toggleVisibility);

export default router;
