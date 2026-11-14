import { createApp } from './app';
import { env } from './config/env';
import { SmtpMailer, createIdentityModule } from './modules/identity';
import { PrismaCampaignUsage, createCampaignsModule } from './modules/campaigns';
import { createTemplatesModule } from './modules/templates';
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
const identity = createIdentityModule({
  mailer,
  db,
  allowedOrigins: env.APP_ORIGINS,
  sessionSecret: env.SESSION_SECRET,
});
// Templates refuse to be unpublished or deleted while a running campaign uses them; the campaigns
// module answers that question, and gets its templates from the templates module (no cycle).
const templates = createTemplatesModule({ db, identity, usage: new PrismaCampaignUsage(db) });
const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
const app = await createApp({ bus, identity, templates, campaigns });
const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));

const shutdown = async () => {
  server.close();
  await bus.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
