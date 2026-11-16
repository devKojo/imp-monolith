import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const slugParamSchema = z.object({ slug }).strict();
export const answerParamSchema = z.object({ slug, questionId: uuidSchema }).strict();

/** Either a chosen option (or rating point) or written text, never both; the kind is checked against the question. */
export const answerSchema = z
  .object({
    choiceIndex: z.number().int().min(0).max(19).optional(),
    text: z.string().max(4000).optional(),
  })
  .strict()
  .refine((a) => (a.choiceIndex === undefined) !== (a.text === undefined), {
    message: 'Send either choiceIndex or text',
  });
