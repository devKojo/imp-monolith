export interface DomainEvent<T = unknown> {
  /** Routing key, e.g. "users.created" */
  type: string;
  payload: T;
  occurredAt: string;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export interface EventBus {
  publish<T>(type: string, payload: T): Promise<void>;
  /** `queue` should be unique per consuming module, e.g. "notifications.users-created". */
  subscribe<T>(type: string, queue: string, handler: EventHandler<T>): Promise<void>;
  close(): Promise<void>;
}
