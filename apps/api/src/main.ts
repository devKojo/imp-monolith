import { createApp } from './app';
import { env } from './config/env';
import { createIdentityModule } from './modules/identity';
import { createTenantDb } from './shared/database';
import { RabbitMqEventBus } from './infrastructure/messaging/rabbitmq-event-bus';

const bus = await RabbitMqEventBus.connect(env.RABBITMQ_URL);
const db = createTenantDb({ connectionString: env.DATABASE_URL, poolMax: env.DB_POOL_MAX });
const identity = createIdentityModule({
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
