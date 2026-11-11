import { z } from 'zod';
import { ROLES, PUBLIC_REGISTRATION_ROLES } from './auth.constants.js';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name is too short')
    .max(120, 'Full name is too long'),
  phone: z.string().trim().min(5).max(32).optional(),
  role: z.enum(PUBLIC_REGISTRATION_ROLES).default(ROLES.CLIENT).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  locationLabel: z.string().trim().max(500).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});
