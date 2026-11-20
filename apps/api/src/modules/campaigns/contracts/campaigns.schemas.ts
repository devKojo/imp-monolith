import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';
import { FIELD_KINDS, FIELD_LIMITS, RESULTS_VISIBILITY } from '../domain/fields';
import { POOL_CURRENCIES, POOL_KINDS, POOL_LIMITS } from '../domain/pool';
import { AMOUNT_MAX, LIMITS, PRIZE_KINDS, PRIZE_SELECTIONS } from '../domain/model';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const idParamSchema = z.object({ id: uuidSchema }).strict();

export const prizeSchema = z
  .object({
    name: z.string().max(LIMITS.prizeNameMax),
    valueLabel: z.string().max(LIMITS.valueMax),
    winners: z.number().int().min(1).max(LIMITS.winnersMax),
    description: z.string().max(LIMITS.descriptionMax),
    // Optional so a client that does not know about rewards still saves; the prize is then an item.
    kind: z.enum(PRIZE_KINDS).optional(),
    amountMinor: z.number().int().min(1).max(AMOUNT_MAX).nullable().optional(),
    currency: z.string().min(3).max(3).nullable().optional(),
    rankFrom: z.number().int().min(1).max(LIMITS.winnersMax).nullable().optional(),
    rankTo: z.number().int().min(1).max(LIMITS.winnersMax).nullable().optional(),
    selection: z.enum(PRIZE_SELECTIONS).nullable().optional(),
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
    // Only a candidate's picture; optional so a client that does not know about it still saves.
    imageUrl: z.string().max(FIELD_LIMITS.imageUrlMax).optional(),
  })
  .strict();

export const settingsSchema = z
  .object({
    quiz: z
      .object({
        timeLimitMinutes: z.number().int().min(1).max(FIELD_LIMITS.timeLimitMax).nullable(),
        passPercent: z.number().int().min(1).max(100),
        // Optional so a client that does not know about retakes still saves; one attempt then.
        maxAttempts: z
          .number()
          .int()
          .min(1)
          .max(FIELD_LIMITS.maxAttemptsMax)
          .default(FIELD_LIMITS.defaultMaxAttempts),
      })
      .strict()
      .nullable(),
    // Poll and image vote: when people see the standings. Optional; dropped for any other type.
    ballot: z
      .object({ showResults: z.enum(RESULTS_VISIBILITY) })
      .strict()
      .nullable()
      .optional(),
    // A draft may hold a pool that is not finished yet (it is checked in full to launch).
    pool: z
      .object({
        kind: z.enum(POOL_KINDS),
        amount: z.number().int().min(0).max(POOL_LIMITS.amountMax),
        currency: z.enum(POOL_CURRENCIES).nullable(),
        maxParticipants: z.number().int().min(0).max(POOL_LIMITS.participantsMax),
      })
      .strict()
      .nullable()
      .optional(),
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
