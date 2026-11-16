import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';
import { FIELD_KINDS, FIELD_LIMITS } from '../domain/fields';
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

export const fieldSchema = z
  .object({
    kind: z.enum(FIELD_KINDS),
    label: z.string().max(FIELD_LIMITS.promptMax),
    helper: z.string().max(FIELD_LIMITS.helperMax),
    required: z.boolean(),
    options: z.array(z.string().max(FIELD_LIMITS.optionMax)).max(FIELD_LIMITS.optionsMax),
    correctIndex: z.number().int().min(0).max(FIELD_LIMITS.optionsMax).nullable(),
  })
  .strict();

export const settingsSchema = z
  .object({
    quiz: z
      .object({
        timeLimitMinutes: z.number().int().min(1).max(FIELD_LIMITS.timeLimitMax).nullable(),
        passPercent: z.number().int().min(1).max(100),
      })
      .strict()
      .nullable(),
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
    fields: z.array(fieldSchema).max(FIELD_LIMITS.fieldsMax),
    settings: settingsSchema,
  })
  .strict();

export const versionedSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();

export const duplicateCampaignSchema = z.object({ title: titleSchema.optional() }).strict();

export const STATUSES = ['DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;

export const listQuerySchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    q: z.string().trim().max(LIMITS.titleMax).optional(),
    /** `true` lists the archived campaigns; by default they are left out. */
    archived: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
