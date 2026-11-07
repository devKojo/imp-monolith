import { z } from 'zod';

const optionalUrl = z.string().url().optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  RABBITMQ_URL: z.string().url().default('amqp://guest:guest@localhost:5672'),
  /** app_runtime role: DML on tenant tables, subject to RLS. */
  DATABASE_URL: z.string().url(),
  /** app_system role: infrastructure tables only (outbox, inbox). */
  DATABASE_URL_SYSTEM: optionalUrl,
  /** app_platform role: BYPASSRLS, Administration module only. */
  DATABASE_URL_PLATFORM: optionalUrl,
  /** Read replica for reports/aggregates (R-DAT-13). */
  DATABASE_URL_READ: optionalUrl,
  /** HMAC key for session-bound CSRF tokens (>= 32 chars). Required in production. */
  SESSION_SECRET: z.string().min(32).optional(),
  /** Comma-separated origins allowed to make state-changing requests. */
  APP_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  /** Max pg pool connections for this process profile (R-DAT-05). */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && !env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}
export type Env = z.infer<typeof schema>;
