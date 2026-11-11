import {
  updateProfileSchema,
  changePasswordSchema,
  adminUpdateUserSchema,
  adminListQuerySchema,
} from './users.schema.js';

import * as service from './users.service.js';
import { ok } from '../../utils/apiResponse.js';

// ── Self-Profile ─────────────────────────────────────────────────────────────

export async function getProfile(req, res, next) {
  try {
    const user = await service.getProfile(req.user.id);
    return ok(res, { user }, 'Profile retrieved');
  } catch (err) {
    return next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await service.updateProfile(req.user.id, data);
    return ok(res, { user }, 'Profile updated');
  } catch (err) {
    return next(err);
  }
}

export async function updateAvatar(req, res, next) {
  try {
    const user = await service.updateAvatar(req.user.id, req.uploadedFile);
    return ok(res, { user }, 'Avatar updated');
  } catch (err) {
    return next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const data = changePasswordSchema.parse(req.body);
    await service.changePassword(req.user.id, data.currentPassword, data.newPassword);
    return ok(res, null, 'Password changed successfully');
  } catch (err) {
    return next(err);
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminList(req, res, next) {
  try {
    const filters = adminListQuerySchema.parse(req.query);
    const result = await service.adminListUsers(filters);
    return ok(res, result, 'Users retrieved');
  } catch (err) {
    return next(err);
  }
}

export async function adminStats(req, res, next) {
  try {
    const stats = await service.adminGetStats();
    return ok(res, { stats }, 'User statistics');
  } catch (err) {
    return next(err);
  }
}

export async function adminGetUser(req, res, next) {
  try {
    const user = await service.adminGetUser(req.params.id);
    return ok(res, { user }, 'User retrieved');
  } catch (err) {
    return next(err);
  }
}

export async function adminUpdateUser(req, res, next) {
  try {
    const data = adminUpdateUserSchema.parse(req.body);
    const user = await service.adminUpdateUser(req.params.id, data);
    return ok(res, { user }, 'User updated');
  } catch (err) {
    return next(err);
  }
}

export async function adminActivate(req, res, next) {
  try {
    const user = await service.adminSetActive(req.params.id, true);
    return ok(res, { user }, 'User activated');
  } catch (err) {
    return next(err);
  }
}

export async function adminDeactivate(req, res, next) {
  try {
    const user = await service.adminSetActive(req.params.id, false);
    return ok(res, { user }, 'User deactivated');
  } catch (err) {
    return next(err);
  }
}
