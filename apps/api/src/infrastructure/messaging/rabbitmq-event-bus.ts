import amqp, { type Channel, type ChannelModel } from 'amqplib';
import type { DomainEvent, EventBus, EventHandler } from './event-bus';

const EXCHANGE = 'imp.events';

export class RabbitMqEventBus implements EventBus {
  private constructor(
    private readonly conn: ChannelModel,
    private readonly pub: Channel,
    private readonly sub: Channel,
  ) {}

  static async connect(url: string): Promise<RabbitMqEventBus> {
    const conn = await amqp.connect(url);
    const pub = await conn.createChannel();
    const sub = await conn.createChannel();
    await pub.assertExchange(EXCHANGE, 'topic', { durable: true });
    return new RabbitMqEventBus(conn, pub, sub);
  }

  async publish<T>(type: string, payload: T) {
    const event: DomainEvent<T> = { type, payload, occurredAt: new Date().toISOString() };
    this.pub.publish(EXCHANGE, type, Buffer.from(JSON.stringify(event)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async subscribe<T>(type: string, queue: string, handler: EventHandler<T>) {
    await this.sub.assertExchange(EXCHANGE, 'topic', { durable: true });
    await this.sub.assertQueue(queue, { durable: true });
    await this.sub.bindQueue(queue, EXCHANGE, type);
    await this.sub.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        await handler(JSON.parse(msg.content.toString()) as DomainEvent<T>);
        this.sub.ack(msg);
      } catch (err) {
        console.error(`[bus] handler failed for ${queue}`, err);
        this.sub.nack(msg, false, false); // TODO: configure a dead-letter exchange
      }
    });
  }

  async close() {
    await this.pub.close();
    await this.sub.close();
    await this.conn.close();
  }
}
