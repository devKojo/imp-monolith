import express from 'express';
import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { errorHandler, notFound } from '@/shared/http';
import { initNotificationsModule } from '@/modules/notifications';
import { createUsersModule } from '@/modules/users';

/** Composition root: wires modules together. Register new modules here. */
export async function createApp(deps: { bus: EventBus }) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const users = createUsersModule(deps);
  app.use(users.basePath, users.router);
  await initNotificationsModule(deps);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
