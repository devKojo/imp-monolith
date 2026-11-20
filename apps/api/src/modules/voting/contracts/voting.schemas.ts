import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const slugParamSchema = z.object({ slug }).strict();
export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();

/** The option voted for, numbered from 0 in the order the campaign lists them. */
export const voteSchema = z.object({ optionIndex: z.number().int().min(0).max(19) }).strict();
