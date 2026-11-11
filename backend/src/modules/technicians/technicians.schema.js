import { z } from 'zod';

const trimStr = (min, max) => z.string().trim().min(min).max(max);

// ── Body: create profile ──────────────────────────────────
export const createProfileSchema = z.object({
  bio: z.string().trim().max(2000).optional().default(''),
  experienceYears: z.coerce.number().int().min(0).max(80).optional().default(0),
  hourlyRate: z.coerce.number().nonnegative().max(100000).optional().default(0),
  inspectionFee: z.coerce.number().nonnegative().max(100000).optional().default(0),
  areaLatitude: z.coerce.number().min(-90).max(90).optional(),
  areaLongitude: z.coerce.number().min(-180).max(180).optional(),
  areaRadiusKm: z.coerce.number().positive().max(500).optional().default(10),
});

// ── Body: update profile (all optional, at least one required) ──
export const updateProfileSchema = z
  .object({
    bio: z.string().trim().max(2000).optional(),
    experienceYears: z.coerce.number().int().min(0).max(80).optional(),
    hourlyRate: z.coerce.number().nonnegative().max(100000).optional(),
    inspectionFee: z.coerce.number().nonnegative().max(100000).optional(),
    isAvailable: z.boolean().optional(),
    areaLatitude: z.coerce.number().min(-90).max(90).optional(),
    areaLongitude: z.coerce.number().min(-180).max(180).optional(),
    areaRadiusKm: z.coerce.number().positive().max(500).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ── Query: public list filters (+ pagination) ─────────────
export const filterSchema = z.object({
  categoryId: z.string().uuid().optional(),
  city: z.string().optional(),
  days: z.preprocess((val) => {
    if (typeof val === 'string') return [parseInt(val)];
    if (Array.isArray(val)) return val.map(v => parseInt(v));
    return val;
  }, z.array(z.number().int().min(0).max(6))).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  available: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── Params: /:id ──────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid technician id'),
});

// ── Specializations ───────────────────────────────────────
export const addSpecializationSchema = z.object({
  categoryId: z.string().uuid('Invalid category id'),
});

// ── Work Days ─────────────────────────────────────────────
export const setWorkDaysSchema = z.object({
  days: z.array(z.object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    isActive: z.boolean(),
  })).min(1).max(7),
});

// ── Time Slots ────────────────────────────────────────────
const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const addTimeSlotSchema = z.object({
  workDayId: z.string().uuid('Invalid work day id'),
  startTime: z.string().regex(timeRegex, 'Time must be HH:MM or HH:MM:SS'),
  endTime: z.string().regex(timeRegex, 'Time must be HH:MM or HH:MM:SS'),
  maxBookings: z.coerce.number().int().min(1).max(50).optional().default(1),
});

export const updateTimeSlotSchema = z
  .object({
    startTime: z.string().regex(timeRegex, 'Time must be HH:MM or HH:MM:SS').optional(),
    endTime: z.string().regex(timeRegex, 'Time must be HH:MM or HH:MM:SS').optional(),
    maxBookings: z.coerce.number().int().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });

export const slotIdParamSchema = z.object({
  id: z.string().uuid('Invalid technician id'),
  slotId: z.string().uuid('Invalid slot id'),
});

// ── Gallery ───────────────────────────────────────────────
export const addGallerySchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  caption: trimStr(0, 255).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
});

export const galleryIdParamSchema = z.object({
  id: z.string().uuid('Invalid technician id'),
  imageId: z.string().uuid('Invalid image id'),
});
