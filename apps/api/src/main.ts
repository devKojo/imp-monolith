import { createApp } from './app';
import { env } from './config/env';
import { RabbitMqEventBus } from './infrastructure/messaging/rabbitmq-event-bus';

const bus = await RabbitMqEventBus.connect(env.RABBITMQ_URL);
const app = await createApp({ bus });
const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));

const shutdown = async () => {
  server.close();
  await bus.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
