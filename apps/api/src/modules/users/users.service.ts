import { randomUUID } from 'node:crypto';
import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { ConflictError, NotFoundError } from '@/shared/errors';
import type { UserRepository } from './users.repository';
import {
  USER_CREATED,
  type CreateUserInput,
  type User,
  type UserCreatedPayload,
} from './users.schemas';

export class UsersService {
  constructor(
    private readonly repo: UserRepository,
    private readonly bus: EventBus,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    if (await this.repo.findByEmail(input.email)) throw new ConflictError('Email already in use');
    const user: User = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
    await this.repo.save(user);
    await this.bus.publish<UserCreatedPayload>(USER_CREATED, {
      id: user.id,
      email: user.email,
      name: user.name,
    });
    return user;
  }

  async get(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  list() {
    return this.repo.list();
  }
}
