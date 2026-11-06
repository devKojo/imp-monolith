import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { USER_CREATED, userCreatedSchema } from '@/modules/users';

export async function registerNotificationSubscribers(bus: EventBus) {
  await bus.subscribe(USER_CREATED, 'notifications.users-created', (event) => {
    const user = userCreatedSchema.parse(event.payload);
    console.log(`[notifications] welcome email -> ${user.email}`);
  });
}
