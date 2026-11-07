import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/** Every id and id-reference in the platform is a UUID; validate all id inputs with this. */
export const uuidSchema = z.string().uuid();

export const isUuid = (value: unknown): value is string => uuidSchema.safeParse(value).success;

/**
 * Time-ordered UUIDv7 (RFC 9562): 48-bit unix-ms timestamp, then random bits. Used where an id
 * is needed before the row is written (e.g. to scope a transaction to the new row's owner).
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
