import { z } from 'zod';

// ── Profile Update ────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name is too short')
    .max(120, 'Full name is too long')
    .optional(),
  phone: z.string().trim().min(5).max(32).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  locationLabel: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(200).optional().nullable(),
  country: z.string().trim().max(200).optional().nullable(),
});

// ── Password Change ───────────────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ── Admin: Update User ───────────────────────────────────────────────────────

export const adminUpdateUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name is too short')
    .max(120, 'Full name is too long')
    .optional(),
  phone: z.string().trim().min(5).max(32).optional().nullable(),
  role: z.enum(['client', 'technician', 'admin']).optional(),
});

// ── Admin: List Users Query ──────────────────────────────────────────────────

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['client', 'technician', 'admin']).optional(),
  search: z.string().trim().max(200).optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});
