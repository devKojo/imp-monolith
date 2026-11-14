import type { PrismaClient } from '@/generated/prisma/client';
import {
  withPublic,
  withTenant,
  writeAudit,
  type TenantContext,
  type TenantTx,
} from '@/shared/database';
import type { QuizRepository } from '../application/ports';
import type {
  AttemptResult,
  AttemptRow,
  CampaignFacts,
  QuestionInput,
  QuizDefinition,
  QuizSettings,
  RunnableQuiz,
} from '../domain/model';
import { LIMITS } from '../domain/model';

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
 * Quizzes in PostgreSQL. Every call is one `withTenant` transaction (row-level security applies) except
 * `locate`, which reads the same running campaigns the public listing shows through `withPublic`.
 */
export class PrismaQuizRepository implements QuizRepository {
  constructor(private readonly db: PrismaClient) {}

  campaignFacts(ctx: TenantContext, campaignId: string): Promise<CampaignFacts | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.campaign.findFirst({
        where: { id: campaignId, tenantId: ctx.tenantId, deletedAt: null },
        select: { status: true, template: { select: { archetype: true } } },
      });
      return row
        ? { status: row.status, archetype: row.template?.archetype.toLowerCase() ?? null }
        : null;
    });
  }

  definition(ctx: TenantContext, campaignId: string): Promise<QuizDefinition> {
    return withTenant(this.db, ctx, async (tx) => {
      const [settings, questions] = await Promise.all([
        tx.quiz.findFirst({ where: { tenantId: ctx.tenantId, campaignId } }),
        tx.quizQuestion.findMany({
          where: { tenantId: ctx.tenantId, campaignId },
          orderBy: { position: 'asc' },
        }),
      ]);
      return {
        settings: {
          timeLimitMinutes: settings?.timeLimitMinutes ?? null,
          passPercent: settings?.passPercent ?? LIMITS.defaultPassPercent,
        },
        questions: questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
        })),
      };
    });
  }

  replace(
    ctx: TenantContext,
    campaignId: string,
    content: { settings: QuizSettings; questions: QuestionInput[] },
  ): Promise<void> {
    return withTenant(this.db, ctx, async (tx: TenantTx) => {
      await tx.quiz.upsert({
        where: { tenantId_campaignId: { tenantId: ctx.tenantId, campaignId } },
        create: { tenantId: ctx.tenantId, campaignId, ...content.settings },
        update: content.settings,
      });
      await tx.quizQuestion.deleteMany({ where: { tenantId: ctx.tenantId, campaignId } });
      await tx.quizQuestion.createMany({
        data: content.questions.map((q, position) => ({
          tenantId: ctx.tenantId,
          campaignId,
          position,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
        })),
      });
      // Counts only: no question text in the audit trail (R-PRV-06).
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'quiz.updated',
        targetType: 'campaign',
        targetId: campaignId,
        metadata: { questions: content.questions.length },
      });
    });
  }

  questionCount(ctx: TenantContext, campaignId: string): Promise<number> {
    return withTenant(this.db, ctx, (tx) =>
      tx.quizQuestion.count({ where: { tenantId: ctx.tenantId, campaignId } }),
    );
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
