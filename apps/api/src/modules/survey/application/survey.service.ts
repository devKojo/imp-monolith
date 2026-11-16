import { randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import {
  InvalidAnswerError,
  NoResponseError,
  ParticipantOnlyError,
  RequiredAnswersError,
  ResponseClosedError,
  SurveyEmptyError,
  SurveyNotFoundError,
} from '../domain/errors';
import type {
  Participant,
  ResponseRow,
  ResponseView,
  RunnableSurvey,
  SurveyInfo,
  SurveyQuestion,
} from '../domain/model';
import { estimatedMinutes, missingRequired, normalizeAnswer } from '../domain/rules';
import type { SurveyRepository } from './ports';

/**
 * Survey workflows for a participant: start one response, save answers as they go, and submit. The
 * questions are written on the campaign; the business is found from the campaign's public address, never
 * from the request.
 */
export class SurveyService {
  constructor(
    private readonly repo: SurveyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async locate(slug: string): Promise<RunnableSurvey> {
    const found = await this.repo.locate(slug, this.now());
    if (!found) throw new SurveyNotFoundError();
    return found;
  }

  private scopeOf(found: RunnableSurvey, actorId?: string): TenantContext {
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
    const questions = await this.repo.questions(ctx, found.campaignId);
    if (questions.length === 0) throw new SurveyEmptyError();
    return { found, ctx, questions, userId: participant.userId };
  }

  /** Public facts about a running survey: enough to decide whether to start. Never the questions. */
  async info(slug: string): Promise<SurveyInfo> {
    const found = await this.locate(slug);
    const questions = await this.repo.questions(this.scopeOf(found), found.campaignId);
    return {
      slug,
      title: found.title,
      businessName: found.businessName,
      endsAt: found.endAt.toISOString(),
      questionCount: questions.length,
      requiredCount: questions.filter((q) => q.required).length,
      estimatedMinutes: estimatedMinutes(questions),
    };
  }

  private view(row: ResponseRow, questions: SurveyQuestion[]): ResponseView {
    return {
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      questions,
      answers: row.answers,
    };
  }

  async start(participant: Participant | null, slug: string): Promise<ResponseView> {
    const { found, ctx, questions, userId } = await this.enter(participant, slug);
    const row =
      (await this.repo.response(ctx, found.campaignId, userId)) ??
      (await this.repo.startResponse(ctx, { campaignId: found.campaignId, userId }));
    return this.view(row, questions);
  }

  async current(participant: Participant | null, slug: string): Promise<ResponseView> {
    const { found, ctx, questions, userId } = await this.enter(participant, slug);
    const row = await this.repo.response(ctx, found.campaignId, userId);
    if (!row) throw new NoResponseError();
    return this.view(row, questions);
  }

  async answer(
    participant: Participant | null,
    slug: string,
    questionId: string,
    input: { choiceIndex?: number; text?: string },
  ): Promise<void> {
    const { found, ctx, questions, userId } = await this.enter(participant, slug);
    const row = await this.repo.response(ctx, found.campaignId, userId);
    if (!row) throw new NoResponseError();
    if (row.submittedAt) throw new ResponseClosedError();

    const question = questions.find((q) => q.id === questionId);
    const value = question ? normalizeAnswer(question, input) : null;
    if (!question || value === null) throw new InvalidAnswerError();
    await this.repo.saveAnswer(ctx, {
      responseId: row.id,
      questionId,
      value: value === 'clear' ? null : value,
    });
  }

  /** Finishes the response once every required question has an answer. Safe to repeat. */
  async submit(participant: Participant | null, slug: string): Promise<ResponseView> {
    const { found, ctx, questions, userId } = await this.enter(participant, slug);
    const row = await this.repo.response(ctx, found.campaignId, userId);
    if (!row) throw new NoResponseError();
    if (row.submittedAt) return this.view(row, questions);

    const missing = missingRequired(questions, row.answers);
    if (missing.length > 0) throw new RequiredAnswersError(missing);

    const at = this.now();
    await this.repo.submit(ctx, { responseId: row.id, at });
    // Whoever submits first wins; either way the stored response is what is returned.
    const done = (await this.repo.response(ctx, found.campaignId, userId)) ?? {
      ...row,
      submittedAt: at,
    };
    return this.view(done, questions);
  }
}
