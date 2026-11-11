import { Router } from 'express';
import * as controller from './technicians.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { ROLES } from '../auth/auth.constants.js';
import { singleUpload } from '../../middleware/upload.js';

const router = Router();

// ── Admin ─────────────────────────────────────────────────
router.get('/admin', requireAuth, requireRole(ROLES.ADMIN), controller.adminList);

// ── Public ────────────────────────────────────────────────
router.get('/categories', controller.listCategories);
router.get('/cities', controller.listCities);
router.get('/me', requireAuth, requireRole(ROLES.TECHNICIAN), controller.getMe);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/:id/specializations', controller.getSpecs);
router.get('/:id/schedule', controller.getSchedule);
router.get('/:id/gallery', controller.getImages);

// ── Technician-only ───────────────────────────────────────
router.post('/', requireAuth, requireRole(ROLES.TECHNICIAN), controller.create);
router.put('/:id', requireAuth, requireRole(ROLES.TECHNICIAN), controller.update);

// Specializations
router.post('/:id/specializations', requireAuth, requireRole(ROLES.TECHNICIAN), controller.addSpec);
router.delete('/:id/specializations/:categoryId', requireAuth, requireRole(ROLES.TECHNICIAN), controller.removeSpec);

// Schedule
router.put('/:id/schedule/work-days', requireAuth, requireRole(ROLES.TECHNICIAN), controller.setSchedule);
router.post('/:id/schedule/slots', requireAuth, requireRole(ROLES.TECHNICIAN), controller.addSlot);
router.put('/:id/schedule/slots/:slotId', requireAuth, requireRole(ROLES.TECHNICIAN), controller.updateSlot);
router.delete('/:id/schedule/slots/:slotId', requireAuth, requireRole(ROLES.TECHNICIAN), controller.removeSlot);

// Gallery (with file upload middleware)
router.post('/:id/gallery', requireAuth, requireRole(ROLES.TECHNICIAN), ...singleUpload('technicians'), controller.addImage);
router.delete('/:id/gallery/:imageId', requireAuth, requireRole(ROLES.TECHNICIAN), controller.removeImage);

// ── Admin-only ───────────────────────────────────────────
router.patch('/:id/verify', requireAuth, requireRole(ROLES.ADMIN), controller.verify);

export default router;
