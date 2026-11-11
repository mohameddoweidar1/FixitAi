import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import * as controller from './notifications.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.put('/read-all', controller.markAllRead);
router.put('/:id/read', controller.markRead);

export default router;
