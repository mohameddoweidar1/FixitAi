import {
  createReviewSchema, updateReviewSchema,
  reviewIdParamSchema, technicianIdParamSchema, reviewListQuerySchema,
} from './reviews.schema.js';
import {
  createReview, updateReview, deleteReview,
  listTechnicianReviews, listAllReviews, toggleReviewVisibility,
} from './reviews.service.js';
import { ok } from '../../utils/apiResponse.js';

// ── Public: list reviews for a technician ─────────────────
export async function listForTechnician(req, res, next) {
  try {
    const { id } = technicianIdParamSchema.parse(req.params);
    const filters = reviewListQuerySchema.parse(req.query);
    const result = await listTechnicianReviews(id, filters);
    return ok(res, result, 'Technician reviews');
  } catch (err) { return next(err); }
}

// ── Admin: list all reviews ───────────────────────────────
export async function listAll(req, res, next) {
  try {
    const filters = reviewListQuerySchema.parse(req.query);
    const result = await listAllReviews(filters);
    return ok(res, result, 'All reviews');
  } catch (err) { return next(err); }
}

// ── Client: create review ─────────────────────────────────
export async function create(req, res, next) {
  try {
    const data = createReviewSchema.parse(req.body);
    const review = await createReview(req.user.id, data);
    return ok(res, { review }, 'Review created', 201);
  } catch (err) { return next(err); }
}

// ── Client: update own review ─────────────────────────────
export async function update(req, res, next) {
  try {
    const { id } = reviewIdParamSchema.parse(req.params);
    const data = updateReviewSchema.parse(req.body);
    const review = await updateReview(id, req.user.id, data);
    return ok(res, { review }, 'Review updated');
  } catch (err) { return next(err); }
}

// ── Client: delete own review ─────────────────────────────
export async function remove(req, res, next) {
  try {
    const { id } = reviewIdParamSchema.parse(req.params);
    await deleteReview(id, req.user.id);
    return ok(res, null, 'Review deleted');
  } catch (err) { return next(err); }
}

// ── Admin: toggle review visibility ───────────────────────
export async function toggleVisibility(req, res, next) {
  try {
    const { id } = reviewIdParamSchema.parse(req.params);
    const review = await toggleReviewVisibility(id);
    return ok(res, { review }, `Review ${review.isVisible ? 'shown' : 'hidden'}`);
  } catch (err) { return next(err); }
}
