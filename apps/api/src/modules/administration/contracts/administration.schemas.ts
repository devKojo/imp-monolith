import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const awardParamSchema = z.object({ awardId: uuidSchema }).strict();
export const reportParamSchema = z.object({ reportId: uuidSchema }).strict();

export const pageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict();

export const reportsQuerySchema = pageQuerySchema.extend({
  status: z.enum(['OPEN', 'REVIEWED', 'DISMISSED']).default('OPEN'),
});

/** A decision changes what a winner is owed, so it carries the reviewer's password again and a reason. */
export const decisionBodySchema = z
  .object({
    decision: z.enum(['release', 'reject', 'revoke']),
    note: z.string().trim().max(500).default(''),
    password: z.string().min(1).max(256),
  })
  .strict();

export const resolveBodySchema = z
  .object({
    status: z.enum(['REVIEWED', 'DISMISSED']),
    note: z.string().trim().max(500).default(''),
  })
  .strict();
