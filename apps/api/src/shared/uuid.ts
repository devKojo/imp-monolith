import { z } from 'zod';

/** Every id and id-reference in the platform is a UUID; validate all id inputs with this. */
export const uuidSchema = z.string().uuid();

export const isUuid = (value: unknown): value is string => uuidSchema.safeParse(value).success;
