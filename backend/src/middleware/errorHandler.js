import { ZodError } from 'zod';
import { fail } from '../utils/apiResponse.js';

export function notFoundHandler(req, res, _next) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// 4-arg signature is required so Express recognizes this as an error handler
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    console.error('[ZodError]', err.flatten().fieldErrors);
    return fail(res, 'Validation failed', 400, err.flatten().fieldErrors);
  }

  const status = err.status || err.statusCode || 500;
  const message =
    status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  if (status >= 500) {
    console.error('[errorHandler]', err);
  }

  return fail(res, message, status);
}
