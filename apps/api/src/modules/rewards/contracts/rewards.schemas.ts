import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();
export const drawParamSchema = z.object({ drawId: uuidSchema }).strict();

export const awardParamSchema = z.object({ awardId: uuidSchema }).strict();

export const myListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(5_000).default(0),
  })
  .strict();

/** Where to send a cash or item award, and the password that confirms it is really the owner. */
export const claimBodySchema = z
  .object({
    method: z.enum(['MOBILE_MONEY', 'BANK_TRANSFER', 'DELIVERY']).optional(),
    destination: z.string().max(300).optional(),
    accountName: z.string().max(100).optional(),
    password: z.string().min(1).max(256).optional(),
  })
  .strict();
