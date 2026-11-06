import request from 'supertest';
import { describe, it } from 'vitest';
import { createApp } from './app';
import { InMemoryEventBus } from './infrastructure/messaging/in-memory-event-bus';

describe('app', () => {
  it('GET /health', async () => {
    const app = await createApp({ bus: new InMemoryEventBus() });
    await request(app).get('/health').expect(200, { status: 'ok' });
  });

  it('POST /users validates body', async () => {
    const app = await createApp({ bus: new InMemoryEventBus() });
    await request(app).post('/users').send({ email: 'nope' }).expect(400);
  });
});
