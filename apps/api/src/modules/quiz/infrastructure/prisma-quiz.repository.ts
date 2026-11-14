import type { PrismaClient } from '@/generated/prisma/client';
import { withPublic, withTenant, type TenantContext } from '@/shared/database';
import type { QuizRepository } from '../application/ports';
import type { AttemptResult, AttemptRow, QuizDefinition, RunnableQuiz } from '../domain/model';

const DEFAULT_PASS_PERCENT = 70;

type AttemptWithAnswers = {
  id: string;
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
          quiz?: { timeLimitMinutes?: unknown; passPercent?: unknown };
        } | null
      )?.quiz;
      return {
        settings: {
          timeLimitMinutes:
            typeof quiz?.timeLimitMinutes === 'number' ? quiz.timeLimitMinutes : null,
          passPercent:
            typeof quiz?.passPercent === 'number' ? quiz.passPercent : DEFAULT_PASS_PERCENT,
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
          OR: [{ status: 'LIVE' }, { status: 'SCHEDULED', startAt: { lte: now } }],
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
        include: { answers: { select: { questionId: true, choiceIndex: true } } },
      });
      return row ? toAttempt(row) : null;
    });
  }

  startAttempt(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; expiresAt: Date | null },
  ): Promise<AttemptRow> {
    return withTenant(this.db, ctx, async (tx) => {
      // The unique (business, campaign, participant) key makes a double click or a second tab return the
      // attempt that already exists instead of creating another.
      const row = await tx.quizAttempt.upsert({
        where: {
          tenantId_campaignId_userId: {
            tenantId: ctx.tenantId,
            campaignId: input.campaignId,
            userId: input.userId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          campaignId: input.campaignId,
          userId: input.userId,
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
