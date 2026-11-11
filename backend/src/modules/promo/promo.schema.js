import { z } from 'zod';

// ── Params ────────────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

// ── Admin: create promo ───────────────────────────────────
export const createPromoSchema = z.object({
  code: z.string().trim().min(2).max(50).transform(v => v.toUpperCase()),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive('Discount value must be positive'),
  maxUses: z.coerce.number().int().positive().nullable().optional().default(null),
  maxUsesPerUser: z.coerce.number().int().positive().default(1),
  minOrderAmount: z.coerce.number().min(0).default(0),
  appliesTo: z.enum(['all', 'bookings', 'marketplace']).default('all'),
  startsAt: z.string().datetime().nullable().optional().default(null),
  expiresAt: z.string().datetime().nullable().optional().default(null),
  isActive: z.boolean().default(true),
});

// ── Admin: update promo ───────────────────────────────────
export const updatePromoSchema = z.object({
  discountType: z.enum(['percentage', 'fixed']).optional(),
  discountValue: z.coerce.number().positive().optional(),
  maxUses: z.coerce.number().int().positive().nullable().optional(),
  maxUsesPerUser: z.coerce.number().int().positive().optional(),
  minOrderAmount: z.coerce.number().min(0).optional(),
  appliesTo: z.enum(['all', 'bookings', 'marketplace']).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── User: validate promo code ─────────────────────────────
export const validatePromoSchema = z.object({
  code: z.string().trim().min(1).max(50).transform(v => v.toUpperCase()),
  subtotal: z.coerce.number().min(0),
  appliesTo: z.enum(['bookings', 'marketplace']),
});

// ── Admin: list promos query ──────────────────────────────
export const promoListQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
