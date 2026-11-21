import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const slugParamSchema = z.object({ slug }).strict();
export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();

const choice = z.number().int().min(0).max(19);

/**
 * The vote: `choices` has one answer per question in order, each numbered from 0 in the order the campaign
 * lists them; `optionIndex` is the same for a ballot with one question (an image vote, or a one-question poll).
 */
export const voteSchema = z.union([
  z.object({ choices: z.array(choice).min(1).max(10) }).strict(),
  z.object({ optionIndex: choice }).strict(),
]);
