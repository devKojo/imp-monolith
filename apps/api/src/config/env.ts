import { config } from 'dotenv';
import { z } from 'zod';

// Load .env for local development (cwd is apps/api under npm workspaces, so also try the repo
// root). Variables already in the environment win, so production and CI are unaffected.
config({ path: ['.env', '../../.env'], quiet: true });

const optionalUrl = z.string().url().optional();
/** Empty values in .env (placeholders) count as unset. */
const optionalText = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

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
    .default('http://localhost:3001')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  /** Public origin of the site (the web app; /api is proxied under it): email links, OAuth redirect. */
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  /** Gmail SMTP (smtp.gmail.com). Use an App Password, never the Google account password. */
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().default(465),
  /** true = implicit TLS (port 465); false = STARTTLS (port 587). */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  /** Display address, e.g. `IMP <you@gmail.com>`. Gmail rewrites it to the authenticated account. */
  MAIL_FROM: optionalText,
  /** Google OAuth client (Sign in with Google). Both must be set to enable it. */
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  /** Max pg pool connections for this process profile (R-DAT-05). */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && !env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}
export type Env = z.infer<typeof schema>;
