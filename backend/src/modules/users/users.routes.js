import { Router } from 'express';
import * as controller from './users.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';
import { singleUpload } from '../../middleware/upload.js';

const router = Router();

// ── Self-Profile (any authenticated user) ────────────────────────────────────
router.get('/profile', requireAuth, controller.getProfile);
router.put('/profile', requireAuth, controller.updateProfile);
router.put('/profile/avatar', requireAuth, ...singleUpload('avatars'), controller.updateAvatar);
router.put('/profile/password', requireAuth, controller.changePassword);

// ── Admin user management ────────────────────────────────────────────────────
router.get('/admin', requireAuth, requireRole(ROLES.ADMIN), controller.adminList);
router.get('/admin/stats', requireAuth, requireRole(ROLES.ADMIN), controller.adminStats);
router.get('/admin/:id', requireAuth, requireRole(ROLES.ADMIN), controller.adminGetUser);
router.patch('/admin/:id', requireAuth, requireRole(ROLES.ADMIN), controller.adminUpdateUser);
router.patch('/admin/:id/activate', requireAuth, requireRole(ROLES.ADMIN), controller.adminActivate);
router.patch('/admin/:id/deactivate', requireAuth, requireRole(ROLES.ADMIN), controller.adminDeactivate);

export default router;
