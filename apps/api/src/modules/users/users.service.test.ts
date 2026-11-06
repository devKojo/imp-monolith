import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '@/infrastructure/messaging/in-memory-event-bus';
import { InMemoryUserRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const setup = () => {
    const bus = new InMemoryEventBus();
    return { bus, service: new UsersService(new InMemoryUserRepository(), bus) };
  };

  it('creates a user and publishes users.created', async () => {
    const { bus, service } = setup();
    const user = await service.create({ email: 'a@b.com', name: 'A' });
    expect(user.id).toBeTruthy();
    expect(bus.published.map((e) => e.type)).toEqual(['users.created']);
  });

  it('rejects duplicate emails', async () => {
    const { service } = setup();
    await service.create({ email: 'a@b.com', name: 'A' });
    await expect(service.create({ email: 'a@b.com', name: 'B' })).rejects.toThrow(
      'Email already in use',
    );
  });
});
