import { z } from 'zod';

// ── Params ────────────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user id'),
});

// ── Top-up ────────────────────────────────────────────────
export const topUpSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be positive')
    .max(99999, 'Amount too large'),
  paymentMethodId: z.string().uuid().optional(),
});

// ── Withdraw ──────────────────────────────────────────────
export const withdrawSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be positive'),
});

// ── Admin adjustment ──────────────────────────────────────
export const adminAdjustSchema = z.object({
  userId: z.string().uuid('Invalid user id'),
  amount: z.coerce
    .number()
    .positive('Amount must be positive'),
  direction: z.enum(['credit', 'debit']),
  reason: z.string().trim().min(3, 'Reason is required').max(500),
});

// ── Transaction list query ────────────────────────────────
export const transactionQuerySchema = z.object({
  type: z.enum(['top_up', 'payment', 'refund', 'admin_adjustment', 'withdrawal']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Saved payment method ──────────────────────────────────
export const addPaymentMethodSchema = z.object({
  provider: z.string().trim().min(1).max(30).default('demo'),
  cardBrand: z.string().trim().min(1).max(30),
  last4: z.string().trim().length(4, 'Must be exactly 4 digits').regex(/^\d{4}$/, 'Must be 4 digits'),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2024).max(2099),
  token: z.string().trim().min(1).max(255),
  isDefault: z.boolean().optional().default(false),
});
