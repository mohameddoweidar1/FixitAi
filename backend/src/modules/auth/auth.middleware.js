import { verifyToken } from './auth.service.js';
import { fail } from '../../utils/apiResponse.js';

/**
 * Parses `Authorization: Bearer <token>`, verifies the JWT, and attaches
 * `req.user = { id, role, email }` for downstream handlers.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return fail(res, 'Missing or malformed Authorization header', 401);
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return fail(res, 'Token expired', 401);
    if (err.name === 'JsonWebTokenError') return fail(res, 'Invalid token', 401);
    if (err.name === 'NotBeforeError') return fail(res, 'Token not active yet', 401);
    return fail(res, 'Authentication failed', 401);
  }
}

/**
 * Restricts access to users whose role is in the allowed list.
 * Usage: requireRole(ROLES.ADMIN) or requireRole(ROLES.ADMIN, ROLES.TECHNICIAN)
 * Must be chained AFTER requireAuth.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Authentication required', 401);
    if (!roles.includes(req.user.role)) {
      return fail(res, 'Insufficient permissions', 403);
    }
    return next();
  };
}
