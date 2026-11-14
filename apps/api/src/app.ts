import express from 'express';
import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { errorHandler, notFound } from '@/shared/http';
import { initNotificationsModule } from '@/modules/notifications';
import { createUsersModule } from '@/modules/users';
import type { IdentityModule } from '@/modules/identity';
import type { CampaignsModule } from '@/modules/campaigns';
import type { TemplatesModule } from '@/modules/templates';

/** Composition root: wires modules together. Register new modules here. */
export async function createApp(deps: {
  bus: EventBus;
  identity?: IdentityModule;
  templates?: TemplatesModule;
  campaigns?: CampaignsModule;
}) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const users = createUsersModule(deps);
  app.use(users.basePath, users.router);
  if (deps.identity) app.use(deps.identity.basePath, deps.identity.router);
  if (deps.templates) app.use(deps.templates.basePath, deps.templates.router);
  if (deps.campaigns) app.use(deps.campaigns.basePath, deps.campaigns.router);
  await initNotificationsModule(deps);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
