import { z } from 'zod';

// ── Params ────────────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

// ── Notifications ─────────────────────────────────────────
export const notificationListQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional().default('false'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Disputes ──────────────────────────────────────────────
export const createDisputeSchema = z.object({
  reportedId: z.string().uuid('Invalid user id'),
  bookingId: z.string().uuid('Invalid booking id').optional(),
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(2000),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolutionNote: z.string().trim().max(2000).optional(),
});

export const disputeListQuerySchema = z.object({
  status: z.enum(['open', 'under_review', 'resolved', 'dismissed']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Chat ──────────────────────────────────────────────────
export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(255).optional().default('New Chat'),
});

export const addMessageSchema = z.object({
  senderType: z.enum(['user', 'ai', 'system']).optional().default('user'),
  content: z.string().trim().min(1, 'Message cannot be empty').max(10000),
});
