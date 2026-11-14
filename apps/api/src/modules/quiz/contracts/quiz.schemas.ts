import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';
import { LIMITS } from '../domain/model';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const slugParamSchema = z.object({ slug }).strict();
export const answerParamSchema = z.object({ slug, questionId: uuidSchema }).strict();

const questionSchema = z
  .object({
    prompt: z.string().max(LIMITS.promptMax),
    options: z.array(z.string().max(LIMITS.optionMax)).max(LIMITS.optionsMax),
    correctIndex: z.number().int().min(0).max(LIMITS.optionsMax),
  })
  .strict();

export const saveQuizSchema = z
  .object({
    timeLimitMinutes: z.number().int().min(1).max(LIMITS.timeLimitMax).nullable(),
    passPercent: z.number().int().min(1).max(100),
    questions: z.array(questionSchema).max(LIMITS.questionsMax),
  })
  .strict();

export const answerSchema = z
  .object({ choiceIndex: z.number().int().min(0).max(LIMITS.optionsMax) })
  .strict();

export type SaveQuizInput = z.infer<typeof saveQuizSchema>;
