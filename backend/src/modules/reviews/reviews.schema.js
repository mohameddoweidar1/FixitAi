import { z } from 'zod';

// ── Params: /:id (review id) ─────────────────────────────
export const reviewIdParamSchema = z.object({
  id: z.string().uuid('Invalid review id'),
});

// ── Params: /technician/:id ──────────────────────────────
export const technicianIdParamSchema = z.object({
  id: z.string().uuid('Invalid technician id'),
});

// ── Body: create review (POST /api/reviews) ──────────────
export const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking id'),
  rating: z.coerce
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: z.string().trim().max(2000, 'Comment is too long').optional().default(''),
});

// ── Body: update review (PUT /api/reviews/:id) ───────────
export const updateReviewSchema = z
  .object({
    rating: z.coerce
      .number()
      .int('Rating must be an integer')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating must be at most 5')
      .optional(),
    comment: z.string().trim().max(2000, 'Comment is too long').optional(),
  })
  .refine((v) => v.rating !== undefined || v.comment !== undefined, {
    message: 'At least one field (rating or comment) must be provided',
  });

// ── Query: list filters + pagination ─────────────────────
export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
