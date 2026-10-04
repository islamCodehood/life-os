import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

export const serverEnvSchema = z.object({
  DATABASE_URL_RUNTIME: optionalUrl,
  DATABASE_URL_MIGRATION: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  CHILD_SESSION_HASH_SECRET: optionalText,
  INTERNAL_SCHEDULER_SECRET: optionalText,
  VAPID_PRIVATE_KEY: optionalText,
  VAPID_SUBJECT: optionalText,
  RUN_DB_SMOKE: z.enum(['0', '1']).optional().default('0'),
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ORIGIN: optionalUrl.default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalText,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalText,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
