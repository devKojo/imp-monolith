import { createApp } from './app';
import { env } from './config/env';
import { SmtpMailer, createIdentityModule } from './modules/identity';
import { createCampaignsModule } from './modules/campaigns';
import { createQuizModule } from './modules/quiz';
import { createSurveyModule } from './modules/survey';
import { createVotingModule } from './modules/voting';
import { createGiveawayModule } from './modules/giveaway';
import { createMyParticipationsModule } from './modules/my-participations';
import { createParticipantsModule } from './modules/participants';
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
// The built-in campaign types are global and read-only; campaigns look them up through the templates
// module, and quizzes and surveys read the questions written on the campaign.
const templates = createTemplatesModule({ db, identity });
const quiz = createQuizModule({ db, identity });
const survey = createSurveyModule({ db, identity });
const voting = createVotingModule({ db, identity });
const giveaway = createGiveawayModule({ db, identity });
const participants = createParticipantsModule({ db, identity });
const myParticipations = createMyParticipationsModule({ db, identity });
const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
const app = await createApp({
  signalSecret: env.SESSION_SECRET,
  ...(env.TRUST_PROXY ? { trustProxy: env.TRUST_PROXY } : {}),
  bus,
  identity,
  templates,
  campaigns,
  quiz,
  survey,
  voting,
  giveaway,
  participants,
  myParticipations,
});
const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));

const shutdown = async () => {
  server.close();
  await bus.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
