import type { TenantContext } from '@/shared/database';
import type { AttemptResult, AttemptRow, QuizDefinition, RunnableQuiz } from '../domain/model';

/**
 * Storage for quiz attempts. The participant side finds the campaign by its public address, then works in
 * that campaign's business scope, which the server decides (never the request) and which only ever reaches
 * this participant's own attempt.
 */
export interface QuizRepository {
  /** The quiz settings and questions written on the campaign. */
  definition(ctx: TenantContext, campaignId: string): Promise<QuizDefinition>;

  /** A running quiz campaign by its public address, or null. */
  locate(slug: string, now: Date): Promise<RunnableQuiz | null>;
  attempt(ctx: TenantContext, campaignId: string, userId: string): Promise<AttemptRow | null>;
  /** Starts the participant's attempt, or returns the one that already exists (never two). */
  startAttempt(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; expiresAt: Date | null },
  ): Promise<AttemptRow>;
  saveAnswer(
    ctx: TenantContext,
    input: { attemptId: string; questionId: string; choiceIndex: number },
  ): Promise<void>;
  /** Marks the attempt finished, only if it is not already; false means someone else finished it first. */
  finish(
    ctx: TenantContext,
    input: { attemptId: string; at: Date; result: AttemptResult },
  ): Promise<boolean>;
}
