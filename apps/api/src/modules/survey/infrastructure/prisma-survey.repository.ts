import type { PrismaClient } from '@/generated/prisma/client';
import { recordSignal, withPublic, withTenant, type TenantContext } from '@/shared/database';
import { claimSeat } from '@/modules/campaigns';
import type { SurveyRepository } from '../application/ports';
import type {
  AnswerValue,
  Answers,
  QuestionKind,
  ResponseRow,
  RunnableSurvey,
  SurveyQuestion,
} from '../domain/model';

const KINDS = ['CHOICE', 'LIKERT', 'TEXT', 'LONG_TEXT'] as const;
const KIND_OF: Record<(typeof KINDS)[number], QuestionKind> = {
  CHOICE: 'choice',
  LIKERT: 'likert',
  TEXT: 'text',
  LONG_TEXT: 'long_text',
};

type ResponseWithAnswers = {
  id: string;
  startedAt: Date;
  submittedAt: Date | null;
  answers: Array<{ questionId: string; choiceIndex: number | null; text: string | null }>;
};

const toAnswers = (rows: ResponseWithAnswers['answers']): Answers => {
  const out: Answers = {};
  for (const a of rows) {
    if (a.choiceIndex !== null) out[a.questionId] = { choiceIndex: a.choiceIndex };
    else if (a.text !== null) out[a.questionId] = { text: a.text };
  }
  return out;
};

const toResponse = (r: ResponseWithAnswers): ResponseRow => ({
  id: r.id,
  startedAt: r.startedAt,
  submittedAt: r.submittedAt,
  answers: toAnswers(r.answers),
});

const withAnswers = { answers: { select: { questionId: true, choiceIndex: true, text: true } } };

/**
 * Survey responses in PostgreSQL. Every call is one `withTenant` transaction (row-level security applies)
 * except `locate`, which reads the same running campaigns the public listing shows through `withPublic`.
 * The questions are the campaign's own content fields.
 */
export class PrismaSurveyRepository implements SurveyRepository {
  constructor(private readonly db: PrismaClient) {}

  questions(ctx: TenantContext, campaignId: string): Promise<SurveyQuestion[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.campaignField.findMany({
        where: { tenantId: ctx.tenantId, campaignId, kind: { in: [...KINDS] } },
        orderBy: { position: 'asc' },
      });
      return rows.map((f) => ({
        id: f.id,
        kind: KIND_OF[f.kind as (typeof KINDS)[number]],
        prompt: f.label,
        helper: f.helper,
        required: f.required,
        options: f.kind === 'CHOICE' ? f.options : [],
      }));
    });
  }

  locate(slug: string, now: Date): Promise<RunnableSurvey | null> {
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
          template: { archetype: 'SURVEY' },
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

  response(ctx: TenantContext, campaignId: string, userId: string): Promise<ResponseRow | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.surveyResponse.findFirst({
        where: { tenantId: ctx.tenantId, campaignId, userId },
        include: withAnswers,
      });
      return row ? toResponse(row) : null;
    });
  }

  startResponse(
    ctx: TenantContext,
    input: { campaignId: string; userId: string },
  ): Promise<ResponseRow> {
    return withTenant(this.db, ctx, async (tx) => {
      // Joining takes a seat on the campaign (a prize pool campaign has a limited number); a double click that
      // finds the response already there does not.
      const existing = await tx.surveyResponse.findFirst({
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
      // The unique (business, campaign, participant) key makes a double click or a second tab return the
      // response that already exists instead of creating another.
      const row = await tx.surveyResponse.upsert({
        where: {
          tenantId_campaignId_userId: {
            tenantId: ctx.tenantId,
            campaignId: input.campaignId,
            userId: input.userId,
          },
        },
        create: { tenantId: ctx.tenantId, campaignId: input.campaignId, userId: input.userId },
        update: {},
        include: withAnswers,
      });
      return toResponse(row);
    });
  }

  saveAnswer(
    ctx: TenantContext,
    input: { responseId: string; questionId: string; value: AnswerValue | null },
  ): Promise<void> {
    return withTenant(this.db, ctx, async (tx) => {
      if (input.value === null) {
        await tx.surveyAnswer.deleteMany({
          where: {
            tenantId: ctx.tenantId,
            responseId: input.responseId,
            questionId: input.questionId,
          },
        });
        return;
      }
      const data = {
        choiceIndex: input.value.choiceIndex ?? null,
        text: input.value.text ?? null,
      };
      await tx.surveyAnswer.upsert({
        where: {
          tenantId_responseId_questionId: {
            tenantId: ctx.tenantId,
            responseId: input.responseId,
            questionId: input.questionId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          responseId: input.responseId,
          questionId: input.questionId,
          ...data,
        },
        update: { ...data, answeredAt: new Date() },
      });
    });
  }

  submit(ctx: TenantContext, input: { responseId: string; at: Date }): Promise<boolean> {
    return withTenant(this.db, ctx, async (tx) => {
      const { count } = await tx.surveyResponse.updateMany({
        where: { id: input.responseId, tenantId: ctx.tenantId, submittedAt: null },
        data: { submittedAt: input.at },
      });
      return count === 1;
    });
  }
}
