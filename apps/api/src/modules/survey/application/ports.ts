import type { TenantContext } from '@/shared/database';
import type { AnswerValue, ResponseRow, RunnableSurvey, SurveyQuestion } from '../domain/model';

/**
 * Storage for survey responses. The participant side finds the campaign by its public address, then works
 * in that campaign's business scope, which the server decides (never the request) and which only ever
 * reaches this participant's own response.
 */
export interface SurveyRepository {
  /** The questions written on the campaign, in order. */
  questions(ctx: TenantContext, campaignId: string): Promise<SurveyQuestion[]>;

  /** A running survey campaign by its public address, or null. */
  locate(slug: string, now: Date): Promise<RunnableSurvey | null>;
  response(ctx: TenantContext, campaignId: string, userId: string): Promise<ResponseRow | null>;
  /** Starts the participant's response, or returns the one that already exists (never two). */
  startResponse(
    ctx: TenantContext,
    input: { campaignId: string; userId: string },
  ): Promise<ResponseRow>;
  /** Saves the answer to one question, or removes it when `value` is null. */
  saveAnswer(
    ctx: TenantContext,
    input: { responseId: string; questionId: string; value: AnswerValue | null },
  ): Promise<void>;
  /** Marks the response submitted, only if it is not already; false means it was submitted first. */
  submit(ctx: TenantContext, input: { responseId: string; at: Date }): Promise<boolean>;
}
