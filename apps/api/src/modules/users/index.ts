// Public surface of the users module. Other modules import ONLY from here.
import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { InMemoryUserRepository } from './users.repository';
import { usersRouter } from './users.routes';
import { UsersService } from './users.service';

export { USER_CREATED, userCreatedSchema, type UserCreatedPayload } from './users.schemas';

export function createUsersModule(deps: { bus: EventBus }) {
  const service = new UsersService(new InMemoryUserRepository(), deps.bus);
  return { basePath: '/users', router: usersRouter(service), service };
}
