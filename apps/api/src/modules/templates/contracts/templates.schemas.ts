import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';
import { ARCHETYPES, FIELD_KINDS, LIMITS } from '../domain/model';
import { KEY_PATTERN } from '../domain/rules';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const idParamSchema = z.object({ id: uuidSchema }).strict();

const text = (max: number) => z.string().max(max);

export const fieldSchema = z
  .object({
    kind: z.enum(FIELD_KINDS),
    key: z.string().regex(KEY_PATTERN, 'Use lowercase letters, numbers and underscores'),
    label: text(LIMITS.labelMax),
    helper: text(LIMITS.helperMax),
    required: z.boolean(),
    options: z.array(text(LIMITS.optionMax)).max(LIMITS.optionsMax),
  })
  .strict();

const nameSchema = z.string().trim().min(1).max(LIMITS.nameMax);

export const createTemplateSchema = z
  .object({ name: nameSchema, archetype: z.enum(ARCHETYPES) })
  .strict();

export const updateTemplateSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    name: nameSchema,
    archetype: z.enum(ARCHETYPES),
    fields: z.array(fieldSchema).max(LIMITS.fieldsMax),
  })
  .strict();

export const versionedSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();

export const duplicateTemplateSchema = z.object({ name: nameSchema.optional() }).strict();

export const listQuerySchema = z
  .object({
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    q: z.string().trim().max(LIMITS.nameMax).optional(),
  })
  .strict();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
