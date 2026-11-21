import express from 'express';
import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { errorHandler, notFound } from '@/shared/http';
import { requestSignals } from '@/shared/request-signals';
import { initNotificationsModule } from '@/modules/notifications';
import { createUsersModule } from '@/modules/users';
import type { IdentityModule } from '@/modules/identity';
import type { CampaignsModule } from '@/modules/campaigns';
import type { TemplatesModule } from '@/modules/templates';
import type { QuizModule } from '@/modules/quiz';
import type { SurveyModule } from '@/modules/survey';
import type { VotingModule } from '@/modules/voting';
import type { GiveawayModule } from '@/modules/giveaway';
import type { RewardsModule } from '@/modules/rewards';
import type { MyParticipationsModule } from '@/modules/my-participations';
import type { ParticipantsModule } from '@/modules/participants';

/** Composition root: wires modules together. Register new modules here. */
export async function createApp(deps: {
  bus: EventBus;
  identity?: IdentityModule;
  templates?: TemplatesModule;
  campaigns?: CampaignsModule;
  quiz?: QuizModule;
  survey?: SurveyModule;
  voting?: VotingModule;
  giveaway?: GiveawayModule;
  rewards?: RewardsModule;
  participants?: ParticipantsModule;
  myParticipations?: MyParticipationsModule;
  /** Key for the abuse-detection hashes (see `request-signals`). Required in production. */
  signalSecret?: string;
  /** Proxy hops to trust for `req.ip`; leave unset when the API is reached directly. */
  trustProxy?: number;
}) {
  const app = express();
  if (deps.trustProxy) app.set('trust proxy', deps.trustProxy);
  app.use(requestSignals(deps.signalSecret ?? 'development-only-signal-secret'));
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const users = createUsersModule(deps);
  app.use(users.basePath, users.router);
  if (deps.identity) app.use(deps.identity.basePath, deps.identity.router);
  if (deps.templates) app.use(deps.templates.basePath, deps.templates.router);
  if (deps.campaigns) app.use(deps.campaigns.basePath, deps.campaigns.router);
  if (deps.campaigns) app.use(deps.campaigns.publicBasePath, deps.campaigns.publicRouter);
  if (deps.quiz) {
    app.use(deps.quiz.participationBasePath, deps.quiz.participationRouter);
    app.use(deps.quiz.publicBasePath, deps.quiz.publicRouter);
  }
  if (deps.participants) app.use(deps.participants.basePath, deps.participants.router);
  if (deps.myParticipations) {
    app.use(deps.myParticipations.basePath, deps.myParticipations.router);
  }
  if (deps.survey) {
    app.use(deps.survey.participationBasePath, deps.survey.participationRouter);
    app.use(deps.survey.publicBasePath, deps.survey.publicRouter);
  }
  if (deps.voting) {
    app.use(deps.voting.basePath, deps.voting.router);
    app.use(deps.voting.publicBasePath, deps.voting.publicRouter);
  }
  if (deps.giveaway) {
    app.use(deps.giveaway.basePath, deps.giveaway.router);
    app.use(deps.giveaway.publicBasePath, deps.giveaway.publicRouter);
  }
  if (deps.rewards) {
    app.use(deps.rewards.basePath, deps.rewards.router);
    app.use(deps.rewards.mineBasePath, deps.rewards.mineRouter);
    app.use(deps.rewards.publicBasePath, deps.rewards.publicRouter);
  }
  await initNotificationsModule(deps);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
