import type { PrismaClient } from '@/generated/prisma/client';
import { recordSignal, withPublic, withTenant, type TenantContext } from '@/shared/database';
import { claimSeat } from '@/modules/campaigns';
import type { QuizRepository } from '../application/ports';
import type { AttemptResult, AttemptRow, QuizDefinition, RunnableQuiz } from '../domain/model';

const DEFAULT_PASS_PERCENT = 70;

type AttemptWithAnswers = {
  id: string;
  attemptNumber: number;
  startedAt: Date;
  expiresAt: Date | null;
  submittedAt: Date | null;
  score: number | null;
  total: number | null;
  passed: boolean | null;
  answers: Array<{ questionId: string; choiceIndex: number }>;
};

const toAttempt = (r: AttemptWithAnswers): AttemptRow => ({
  id: r.id,
  attemptNumber: r.attemptNumber,
  startedAt: r.startedAt,
  expiresAt: r.expiresAt,
  submittedAt: r.submittedAt,
  score: r.score,
  total: r.total,
  passed: r.passed,
  answers: Object.fromEntries(r.answers.map((a) => [a.questionId, a.choiceIndex])),
});

/**
 * Quiz attempts in PostgreSQL. Every call is one `withTenant` transaction (row-level security applies)
 * except `locate`, which reads the same running campaigns the public listing shows through `withPublic`.
 * The questions are the campaign's quiz-question fields and the settings are on the campaign itself.
 */
export class PrismaQuizRepository implements QuizRepository {
  constructor(private readonly db: PrismaClient) {}

  definition(ctx: TenantContext, campaignId: string): Promise<QuizDefinition> {
    return withTenant(this.db, ctx, async (tx) => {
      const [campaign, questions] = await Promise.all([
        tx.campaign.findFirst({
          where: { id: campaignId, tenantId: ctx.tenantId, deletedAt: null },
          select: { settings: true },
        }),
        tx.campaignField.findMany({
          where: { tenantId: ctx.tenantId, campaignId, kind: 'QUIZ_QUESTION' },
          orderBy: { position: 'asc' },
        }),
      ]);
      const quiz = (
        campaign?.settings as {
          quiz?: { timeLimitMinutes?: unknown; passPercent?: unknown; maxAttempts?: unknown };
        } | null
      )?.quiz;
      return {
        settings: {
          timeLimitMinutes:
            typeof quiz?.timeLimitMinutes === 'number' ? quiz.timeLimitMinutes : null,
          passPercent:
            typeof quiz?.passPercent === 'number' ? quiz.passPercent : DEFAULT_PASS_PERCENT,
          maxAttempts: typeof quiz?.maxAttempts === 'number' ? quiz.maxAttempts : 1,
        },
        questions: questions.map((q) => ({
          id: q.id,
          prompt: q.label,
          options: q.options,
          // A question without a marked answer cannot be launched; -1 can never match a choice.
          correctIndex: q.correctIndex ?? -1,
        })),
      };
    });
  }

  locate(slug: string, now: Date): Promise<RunnableQuiz | null> {
    return withPublic(this.db, async (tx) => {
      const row = await tx.campaign.findFirst({
        where: {
          slug,
          deletedAt: null,
          endAt: { gt: now },
          // COMPLETED here (with the end date still ahead) means a prize pool campaign that is full: people
          // already in can finish; a new person is refused when they try to take a seat.
          OR: [
            { status: 'LIVE' },
            { status: 'SCHEDULED', startAt: { lte: now } },
            { status: 'COMPLETED' },
          ],
          business: { status: { in: ['PENDING', 'ACTIVE'] } },
          template: { archetype: 'QUIZ' },
        },
        select: {
          id: true,
          tenantId: true,
          title: true,
          endAt: true,
          business: { select: { name: true } },
        },
      });
      return row && row.endAt
        ? {
            campaignId: row.id,
            tenantId: row.tenantId,
            title: row.title,
            businessName: row.business.name,
            endAt: row.endAt,
          }
        : null;
    });
  }

  attempt(ctx: TenantContext, campaignId: string, userId: string): Promise<AttemptRow | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.quizAttempt.findFirst({
        where: { tenantId: ctx.tenantId, campaignId, userId },
        orderBy: { attemptNumber: 'desc' },
        include: { answers: { select: { questionId: true, choiceIndex: true } } },
      });
      return row ? toAttempt(row) : null;
    });
  }

  startAttempt(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; attemptNumber: number; expiresAt: Date | null },
  ): Promise<AttemptRow> {
    return withTenant(this.db, ctx, async (tx) => {
      // A person's first attempt takes a seat on the campaign (a prize pool campaign has a limited number);
      // a retake, or a double click that finds the attempt already there, does not.
      const existing = await tx.quizAttempt.findFirst({
        where: {
          tenantId: ctx.tenantId,
          campaignId: input.campaignId,
          userId: input.userId,
        },
        select: { id: true },
      });
      if (!existing) {
        await claimSeat(tx, ctx.tenantId, input.campaignId);
        await recordSignal(tx, {
          tenantId: ctx.tenantId,
          campaignId: input.campaignId,
          userId: input.userId,
          kind: 'JOIN',
        });
      }
      // The unique (business, campaign, participant, number) key makes a double click or a second tab return
      // the attempt that already exists instead of creating another with the same number.
      const row = await tx.quizAttempt.upsert({
        where: {
          tenantId_campaignId_userId_attemptNumber: {
            tenantId: ctx.tenantId,
            campaignId: input.campaignId,
            userId: input.userId,
            attemptNumber: input.attemptNumber,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          campaignId: input.campaignId,
          userId: input.userId,
          attemptNumber: input.attemptNumber,
          expiresAt: input.expiresAt,
        },
        update: {},
        include: { answers: { select: { questionId: true, choiceIndex: true } } },
      });
      return toAttempt(row);
    });
  }

  saveAnswer(
    ctx: TenantContext,
    input: { attemptId: string; questionId: string; choiceIndex: number },
  ): Promise<void> {
    return withTenant(this.db, ctx, async (tx) => {
      await tx.quizAnswer.upsert({
        where: {
          tenantId_attemptId_questionId: {
            tenantId: ctx.tenantId,
            attemptId: input.attemptId,
            questionId: input.questionId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          attemptId: input.attemptId,
          questionId: input.questionId,
          choiceIndex: input.choiceIndex,
        },
        update: { choiceIndex: input.choiceIndex, answeredAt: new Date() },
      });
    });
  }

  finish(
    ctx: TenantContext,
    input: { attemptId: string; at: Date; result: AttemptResult },
  ): Promise<boolean> {
    return withTenant(this.db, ctx, async (tx) => {
      const { count } = await tx.quizAttempt.updateMany({
        where: { id: input.attemptId, tenantId: ctx.tenantId, submittedAt: null },
        data: {
          submittedAt: input.at,
          score: input.result.score,
          total: input.result.total,
          passed: input.result.passed,
        },
      });
      return count === 1;
    });
  }
}
