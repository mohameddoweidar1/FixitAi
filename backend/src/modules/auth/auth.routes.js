import { Router } from 'express';
import * as controller from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const router = Router();

// Public
router.post('/register', controller.register);
router.post('/login', controller.login);

// Protected
router.get('/me', requireAuth, controller.me);

export default router;
