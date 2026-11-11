import { registerSchema, loginSchema } from './auth.schema.js';
import { registerUser, loginUser, getCurrentUser } from './auth.service.js';
import { ok } from '../../utils/apiResponse.js';

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerUser(data);
    return ok(res, result, 'Registered successfully', 201);
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginUser(data);
    return ok(res, result, 'Login successful');
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);
    return ok(res, { user }, 'Current user');
  } catch (err) {
    return next(err);
  }
}
