import {
  createPromoSchema, updatePromoSchema, validatePromoSchema,
  promoListQuerySchema, idParamSchema,
} from './promo.schema.js';
import {
  createPromo, updatePromo, deactivatePromo,
  getPromoById, listPromos,
  validatePromoCode, getRedemptionStats,
} from './promo.service.js';
import { ok, fail } from '../../utils/apiResponse.js';

// ── Admin CRUD ───────────────────────────────────────────

export async function createPromoHandler(req, res, next) {
  try {
    const data = createPromoSchema.parse(req.body);
    const promo = await createPromo(req.user.id, data);
    return ok(res, { promo }, 'Promo code created', 201);
  } catch (err) { return next(err); }
}

export async function updatePromoHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updatePromoSchema.parse(req.body);
    const promo = await updatePromo(id, data);
    return ok(res, { promo }, 'Promo code updated');
  } catch (err) { return next(err); }
}

export async function deactivatePromoHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const promo = await deactivatePromo(id);
    return ok(res, { promo }, 'Promo code deactivated');
  } catch (err) { return next(err); }
}

export async function listPromosHandler(req, res, next) {
  try {
    const filters = promoListQuerySchema.parse(req.query);
    const result = await listPromos(filters);
    return ok(res, result, 'Promo codes');
  } catch (err) { return next(err); }
}

export async function getPromoHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const promo = await getPromoById(id);
    if (!promo) return fail(res, 'Promo code not found', 404);
    return ok(res, { promo }, 'Promo code details');
  } catch (err) { return next(err); }
}

export async function getPromoStatsHandler(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const stats = await getRedemptionStats(id);
    return ok(res, stats, 'Promo code stats');
  } catch (err) { return next(err); }
}

// ── User: validate promo ─────────────────────────────────

export async function validatePromoHandler(req, res, next) {
  try {
    const data = validatePromoSchema.parse(req.body);
    const result = await validatePromoCode(data.code, req.user.id, data.subtotal, data.appliesTo);
    return ok(res, result, 'Promo code is valid');
  } catch (err) { return next(err); }
}
