import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';
import { LIMITS } from '../domain/model';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const idParamSchema = z.object({ id: uuidSchema }).strict();

export const prizeSchema = z
  .object({
    name: z.string().max(LIMITS.prizeNameMax),
    valueLabel: z.string().max(LIMITS.valueMax),
    winners: z.number().int().min(1).max(LIMITS.winnersMax),
    description: z.string().max(LIMITS.descriptionMax),
  })
  .strict();

const titleSchema = z.string().trim().min(1).max(LIMITS.titleMax);
const instant = z.string().datetime({ offset: true });

export const createCampaignSchema = z
  .object({ title: titleSchema, templateId: uuidSchema.nullable().optional() })
  .strict();

export const updateCampaignSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    title: titleSchema,
    summary: z.string().max(LIMITS.summaryMax),
    templateId: uuidSchema.nullable(),
    startAt: instant.nullable(),
    endAt: instant.nullable(),
    prizes: z.array(prizeSchema).max(LIMITS.prizesMax),
  })
  .strict();

export const versionedSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();

export const duplicateCampaignSchema = z.object({ title: titleSchema.optional() }).strict();

export const STATUSES = ['DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;

export const listQuerySchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    q: z.string().trim().max(LIMITS.titleMax).optional(),
  })
  .strict();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
