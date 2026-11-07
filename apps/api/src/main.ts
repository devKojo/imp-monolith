import { createApp } from './app';
import { env } from './config/env';
import { GoogleOAuth, SmtpMailer, createIdentityModule } from './modules/identity';
import { createTenantDb } from './shared/database';
import { RabbitMqEventBus } from './infrastructure/messaging/rabbitmq-event-bus';

const bus = await RabbitMqEventBus.connect(env.RABBITMQ_URL);
const db = createTenantDb({ connectionString: env.DATABASE_URL, poolMax: env.DB_POOL_MAX });
// Gmail SMTP when configured; otherwise the dev console mailer (which refuses to run in production).
const mailer =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? new SmtpMailer({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.MAIL_FROM,
        publicUrl: env.APP_PUBLIC_URL,
      })
    : undefined;
const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? new GoogleOAuth({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/api/v1/auth/google/callback`,
      })
    : undefined;
const identity = createIdentityModule({
  mailer,
  google,
  db,
  allowedOrigins: env.APP_ORIGINS,
  sessionSecret: env.SESSION_SECRET,
});
const app = await createApp({ bus, identity });
const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));

const shutdown = async () => {
  server.close();
  await bus.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
