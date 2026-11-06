import type { DomainEvent, EventBus, EventHandler } from './event-bus';

/** Synchronous bus for unit tests. */
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();
  readonly published: DomainEvent[] = [];

  async publish<T>(type: string, payload: T) {
    const event: DomainEvent<T> = { type, payload, occurredAt: new Date().toISOString() };
    this.published.push(event);
    for (const h of this.handlers.get(type) ?? []) await h(event);
  }
  async subscribe<T>(type: string, _queue: string, handler: EventHandler<T>) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler as EventHandler]);
  }
  async close() {}
}
