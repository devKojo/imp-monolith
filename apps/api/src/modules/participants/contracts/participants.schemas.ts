import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const LIST_LIMIT_MAX = 100;

export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();

export const listQuerySchema = z
  .object({
    campaignId: uuidSchema.optional(),
    status: z.enum(['in_progress', 'completed']).optional(),
    limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict();
