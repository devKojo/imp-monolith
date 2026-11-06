import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  RABBITMQ_URL: z.string().url().default('amqp://guest:guest@localhost:5672'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
