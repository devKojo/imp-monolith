import { randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import {
  AttemptClosedError,
  InvalidAnswerError,
  NoAttemptError,
  ParticipantOnlyError,
  QuizEmptyError,
  QuizNotFoundError,
} from '../domain/errors';
import type {
  AttemptRow,
  AttemptView,
  Participant,
  QuizDefinition,
  QuizInfo,
  RunnableQuiz,
} from '../domain/model';
import { attemptDeadline, isExpired, scoreAttempt } from '../domain/rules';
import type { QuizRepository } from './ports';

/**
 * Quiz workflows for a participant: start one attempt, save answers as they go, and be scored by the
 * server. The questions and settings are written on the campaign; the correct answers never leave the
 * server, and the clock that counts is the one stored with the attempt.
 */
export class QuizService {
  constructor(
    private readonly repo: QuizRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // --- The participant: take the quiz ------------------------------------------------------

  private async locate(slug: string): Promise<RunnableQuiz> {
    const found = await this.repo.locate(slug, this.now());
    if (!found) throw new QuizNotFoundError();
    return found;
  }

  /** The business comes from the campaign found by address, never from the request. */
  private scopeOf(found: RunnableQuiz, actorId?: string): TenantContext {
    return createTenantContext({
      tenantId: found.tenantId,
      ...(actorId ? { actorId } : {}),
      requestId: randomUUID(),
    });
  }

  private async enter(participant: Participant | null, slug: string) {
    if (participant?.accountType !== 'PARTICIPANT') throw new ParticipantOnlyError();
    const found = await this.locate(slug);
    const ctx = this.scopeOf(found, participant.userId);
    const def = await this.repo.definition(ctx, found.campaignId);
    if (def.questions.length === 0) throw new QuizEmptyError();
    return { found, ctx, def, userId: participant.userId };
  }

  /** Public facts about a running quiz: enough to decide whether to start. */
  async info(slug: string): Promise<QuizInfo> {
    const found = await this.locate(slug);
    const def = await this.repo.definition(this.scopeOf(found), found.campaignId);
    return {
      slug,
      title: found.title,
      businessName: found.businessName,
      endsAt: found.endAt.toISOString(),
      questionCount: def.questions.length,
      timeLimitMinutes: def.settings.timeLimitMinutes,
      passPercent: def.settings.passPercent,
    };
  }

  private view(row: AttemptRow, def: QuizDefinition): AttemptView {
    const finished = row.submittedAt !== null && row.score !== null && row.total !== null;
    return {
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      serverTime: this.now().toISOString(),
      questions: def.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
      answers: row.answers,
      result: finished
        ? {
            score: row.score ?? 0,
            total: row.total ?? 0,
            passed: row.passed ?? false,
            passPercent: def.settings.passPercent,
          }
        : null,
    };
  }

  /** Scores and closes the attempt, once. Whoever gets there first wins; the other reads the result. */
  private async close(
    ctx: TenantContext,
    campaignId: string,
    userId: string,
    row: AttemptRow,
    def: QuizDefinition,
    at: Date,
  ): Promise<AttemptRow> {
    if (row.submittedAt) return row;
    const result = scoreAttempt(def.questions, row.answers, def.settings.passPercent);
    const done = await this.repo.finish(ctx, { attemptId: row.id, at, result });
    if (done) {
      return {
        ...row,
        submittedAt: at,
        score: result.score,
        total: result.total,
        passed: result.passed,
      };
    }
    return (await this.repo.attempt(ctx, campaignId, userId)) ?? row;
  }

  /** The attempt as it stands now, closing it first if its time has run out. */
  private async fresh(
    ctx: TenantContext,
    campaignId: string,
    userId: string,
    row: AttemptRow,
    def: QuizDefinition,
  ): Promise<AttemptRow> {
    const at = this.now();
    return !row.submittedAt && isExpired(row.expiresAt, at)
      ? this.close(ctx, campaignId, userId, row, def, row.expiresAt ?? at)
      : row;
  }

  async start(participant: Participant | null, slug: string): Promise<AttemptView> {
    const { found, ctx, def, userId } = await this.enter(participant, slug);
    const now = this.now();
    const existing = await this.repo.attempt(ctx, found.campaignId, userId);
    const row =
      existing ??
      (await this.repo.startAttempt(ctx, {
        campaignId: found.campaignId,
        userId,
        expiresAt: attemptDeadline(now, def.settings, found.endAt),
      }));
    return this.view(await this.fresh(ctx, found.campaignId, userId, row, def), def);
  }

  async current(participant: Participant | null, slug: string): Promise<AttemptView> {
    const { found, ctx, def, userId } = await this.enter(participant, slug);
    const row = await this.repo.attempt(ctx, found.campaignId, userId);
    if (!row) throw new NoAttemptError();
    return this.view(await this.fresh(ctx, found.campaignId, userId, row, def), def);
  }

  async answer(
    participant: Participant | null,
    slug: string,
    questionId: string,
    choiceIndex: number,
  ): Promise<void> {
    const { found, ctx, def, userId } = await this.enter(participant, slug);
    const stored = await this.repo.attempt(ctx, found.campaignId, userId);
    if (!stored) throw new NoAttemptError();
    const row = await this.fresh(ctx, found.campaignId, userId, stored, def);
    if (row.submittedAt) throw new AttemptClosedError();

    const question = def.questions.find((q) => q.id === questionId);
    if (!question || choiceIndex >= question.options.length) throw new InvalidAnswerError();
    await this.repo.saveAnswer(ctx, { attemptId: row.id, questionId, choiceIndex });
  }

  /** Finishes the attempt. Safe to repeat: a second call returns the same result. */
  async submit(participant: Participant | null, slug: string): Promise<AttemptView> {
    const { found, ctx, def, userId } = await this.enter(participant, slug);
    const row = await this.repo.attempt(ctx, found.campaignId, userId);
    if (!row) throw new NoAttemptError();
    const at = this.now();
    const closing = !row.submittedAt && isExpired(row.expiresAt, at) ? (row.expiresAt ?? at) : at;
    return this.view(await this.close(ctx, found.campaignId, userId, row, def, closing), def);
  }
}
