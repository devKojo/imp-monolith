import type { EventBus } from '@/infrastructure/messaging/event-bus';
import { registerNotificationSubscribers } from './notifications.subscriber';

export async function initNotificationsModule(deps: { bus: EventBus }) {
  await registerNotificationSubscribers(deps.bus);
}
