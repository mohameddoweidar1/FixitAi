import { z } from 'zod';

const BOOKING_STATUSES = ['pending', 'accepted', 'in_progress', 'rejected', 'cancelled', 'completed'];
const TECHNICIAN_SETTABLE = ['accepted', 'rejected', 'in_progress', 'completed'];

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

// ── Params: /:id ──────────────────────────────────────────
export const bookingIdParamSchema = z.object({
  id: z.string().uuid('Invalid booking id'),
});

// ── Body: create booking (POST /api/bookings) ─────────────
export const createBookingSchema = z.object({
  technicianId: z.string().uuid('Invalid technician id'),
  categoryId: z.string().uuid('Invalid category id').optional(),
  slotId: z.string().uuid('Invalid slot id').optional(),
  bookingDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
  serviceTitle: z.string().trim().min(2, 'Service title is too short').max(120, 'Service title is too long'),
  description: z.string().trim().max(2000).optional().default(''),
  agreedPrice: z.coerce.number().nonnegative().max(1000000).optional(),
  clientLatitude: z.coerce.number().min(-90).max(90).optional(),
  clientLongitude: z.coerce.number().min(-180).max(180).optional(),
  clientAddress: z.string().trim().max(500).optional().default(''),
});

// ── Body: technician updates status (PATCH /:id/status) ───
export const updateStatusSchema = z.object({
  status: z.enum(TECHNICIAN_SETTABLE, {
    errorMap: () => ({ message: `Status must be one of: ${TECHNICIAN_SETTABLE.join(', ')}` }),
  }),
});

// ── Body: admin overrides status (PATCH /:id/admin-status) ─
export const adminUpdateStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${BOOKING_STATUSES.join(', ')}` }),
  }),
});

// ── Body: cancel booking ──────────────────────────────────
export const cancelBookingSchema = z.object({
  cancellationNote: z.string().trim().max(1000).optional(),
});

// ── Query: list filters + pagination ──────────────────────
export const bookingListQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES, {
    errorMap: () => ({ message: `Status filter must be one of: ${BOOKING_STATUSES.join(', ')}` }),
  }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
