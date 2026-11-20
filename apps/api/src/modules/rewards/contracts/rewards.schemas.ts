import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();
export const drawParamSchema = z.object({ drawId: uuidSchema }).strict();

export const awardParamSchema = z.object({ awardId: uuidSchema }).strict();

/** A business reviewing an award the risk rules held. */
export const reviewBodySchema = z
  .object({
    decision: z.enum(['release', 'reject']),
    // Why it was rejected; a release needs none.
    reason: z.enum(['NOT_ELIGIBLE', 'SUSPECTED_ABUSE', 'OTHER']).optional(),
  })
  .strict()
  .refine((b) => b.decision === 'release' || b.reason !== undefined, {
    message: 'Say why the award is rejected',
    path: ['reason'],
  });

/** A winner's scam report. */
export const reportBodySchema = z
  .object({
    reason: z.enum(['ASKED_TO_PAY', 'SUSPICIOUS_CONTACT', 'NOT_RECEIVED', 'OTHER']),
    details: z.string().trim().max(1000).optional(),
  })
  .strict();

/** The business's own payment reference (a transfer id, receipt number or tracking number). */
export const fulfilBodySchema = z.object({ reference: z.string().trim().min(3).max(80) }).strict();

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
