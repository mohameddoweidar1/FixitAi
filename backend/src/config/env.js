import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    CORS_ORIGIN: z.string().default('*'),

    DATABASE_URL: z.string().url().optional(),

    DB_HOST: z.string().optional(),
    DB_PORT: z.coerce.number().int().positive().optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_NAME: z.string().optional(),

    // Auth
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

    // Uploads
    STORAGE_PROVIDER: z.enum(['local', 's3', 'cloudinary']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().default(5),
  })
  .superRefine((val, ctx) => {
    if (!val.DATABASE_URL) {
      const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
      for (const key of required) {
        if (val[key] === undefined || val[key] === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when DATABASE_URL is not set`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
