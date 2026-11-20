import type { PrismaClient } from '@/generated/prisma/client';
import { withTenant, type TenantContext } from '@/shared/database';
import type { ParticipantsRepository } from '../application/ports';
import {
  ACTIVITY_DAYS,
  type BusinessActivity,
  type CampaignActivity,
  type CampaignParticipation,
  type ListQuery,
  type ParticipantSummary,
  type Participation,
  type ParticipationPage,
} from '../domain/model';

/**
 * What a business sees about its participants, read from quiz attempts and survey responses in one
 * `withTenant` transaction (row-level security applies). A participant's identity is the id and name
 * only: nothing else of the account is selected.
 */
export class PrismaParticipantsRepository implements ParticipantsRepository {
  constructor(private readonly db: PrismaClient) {}

  summary(ctx: TenantContext): Promise<ParticipantSummary> {
    return withTenant(this.db, ctx, async (tx) => {
      const where = { tenantId: ctx.tenantId };
      const [
        quizPeople,
        surveyPeople,
        votePeople,
        entryPeople,
        quizStarted,
        quizDone,
        surveyStarted,
        surveyDone,
        voteCounts,
        entryCounts,
      ] = await Promise.all([
        tx.quizAttempt.findMany({ where, select: { userId: true }, distinct: ['userId'] }),
        tx.surveyResponse.findMany({ where, select: { userId: true }, distinct: ['userId'] }),
        tx.vote.findMany({ where, select: { userId: true }, distinct: ['userId'] }),
        tx.giveawayEntry.findMany({ where, select: { userId: true }, distinct: ['userId'] }),
        tx.quizAttempt.groupBy({ by: ['campaignId'], where, _count: { _all: true } }),
        tx.quizAttempt.groupBy({
          by: ['campaignId'],
          where: { ...where, submittedAt: { not: null } },
          _count: { _all: true },
        }),
        tx.surveyResponse.groupBy({ by: ['campaignId'], where, _count: { _all: true } }),
        tx.surveyResponse.groupBy({
          by: ['campaignId'],
          where: { ...where, submittedAt: { not: null } },
          _count: { _all: true },
        }),
        tx.vote.groupBy({ by: ['campaignId'], where, _count: { _all: true } }),
        tx.giveawayEntry.groupBy({ by: ['campaignId'], where, _count: { _all: true } }),
      ]);

      const ids = [
        ...new Set(
          [...quizStarted, ...surveyStarted, ...voteCounts, ...entryCounts].map(
            (g) => g.campaignId,
          ),
        ),
      ];
      const titles = new Map(
        (
          await tx.campaign.findMany({
            where: { tenantId: ctx.tenantId, id: { in: ids } },
            select: { id: true, title: true, template: { select: { archetype: true } } },
          })
        ).map((c) => [c.id, c]),
      );
      const done = (rows: Array<{ campaignId: string; _count: { _all: number } }>) =>
        new Map(rows.map((r) => [r.campaignId, r._count._all]));
      const quizDoneBy = done(quizDone);
      const surveyDoneBy = done(surveyDone);

      const campaigns: CampaignParticipation[] = [
        ...quizStarted.map((g) => ({
          campaignId: g.campaignId,
          title: titles.get(g.campaignId)?.title ?? '',
          kind: 'quiz' as const,
          started: g._count._all,
          completed: quizDoneBy.get(g.campaignId) ?? 0,
        })),
        ...surveyStarted.map((g) => ({
          campaignId: g.campaignId,
          title: titles.get(g.campaignId)?.title ?? '',
          kind: 'survey' as const,
          started: g._count._all,
          completed: surveyDoneBy.get(g.campaignId) ?? 0,
        })),
        // A vote or an entry is complete the moment it is made.
        ...voteCounts.map((g) => ({
          campaignId: g.campaignId,
          title: titles.get(g.campaignId)?.title ?? '',
          kind: (titles.get(g.campaignId)?.template?.archetype === 'POLL' ? 'poll' : 'vote') as
            'poll' | 'vote',
          started: g._count._all,
          completed: g._count._all,
        })),
        ...entryCounts.map((g) => ({
          campaignId: g.campaignId,
          title: titles.get(g.campaignId)?.title ?? '',
          kind: 'giveaway' as const,
          started: g._count._all,
          completed: g._count._all,
        })),
      ].sort((a, b) => b.started - a.started || a.title.localeCompare(b.title));

      return {
        participants: new Set(
          [...quizPeople, ...surveyPeople, ...votePeople, ...entryPeople].map((p) => p.userId),
        ).size,
        started: campaigns.reduce((n, c) => n + c.started, 0),
        completed: campaigns.reduce((n, c) => n + c.completed, 0),
        campaigns,
      };
    });
  }

  activity(ctx: TenantContext, today: Date): Promise<BusinessActivity> {
    return withTenant(this.db, ctx, async (tx) => {
      const day = (d: Date) => d.toISOString().slice(0, 10);
      const end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      const since = new Date(end.getTime() - (ACTIVITY_DAYS - 1) * 86_400_000);
      const where = { tenantId: ctx.tenantId };

      type DayRow = { day: string; n: number };
      const [quizStarted, quizDone, surveyStarted, surveyDone, voted, entered] = await Promise.all([
        tx.$queryRaw<DayRow[]>`
          SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM quiz_attempts
          WHERE tenant_id = ${ctx.tenantId}::uuid AND started_at >= ${since}
          GROUP BY 1`,
        tx.$queryRaw<DayRow[]>`
          SELECT to_char(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM quiz_attempts
          WHERE tenant_id = ${ctx.tenantId}::uuid AND submitted_at >= ${since}
          GROUP BY 1`,
        tx.$queryRaw<DayRow[]>`
          SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM survey_responses
          WHERE tenant_id = ${ctx.tenantId}::uuid AND started_at >= ${since}
          GROUP BY 1`,
        tx.$queryRaw<DayRow[]>`
          SELECT to_char(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM survey_responses
          WHERE tenant_id = ${ctx.tenantId}::uuid AND submitted_at >= ${since}
          GROUP BY 1`,
        tx.$queryRaw<DayRow[]>`
          SELECT to_char(cast_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM votes
          WHERE tenant_id = ${ctx.tenantId}::uuid AND cast_at >= ${since}
          GROUP BY 1`,
        tx.$queryRaw<DayRow[]>`
          SELECT to_char(entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM giveaway_entries
          WHERE tenant_id = ${ctx.tenantId}::uuid AND entered_at >= ${since}
          GROUP BY 1`,
      ]);
      const sum = (...lists: DayRow[][]) => {
        const by = new Map<string, number>();
        for (const r of lists.flat()) by.set(r.day, (by.get(r.day) ?? 0) + r.n);
        return by;
      };
      // A vote or an entry starts and completes at the same moment.
      const startedBy = sum(quizStarted, surveyStarted, voted, entered);
      const completedBy = sum(quizDone, surveyDone, voted, entered);
      const daily = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
        const date = day(new Date(since.getTime() + i * 86_400_000));
        return { date, started: startedBy.get(date) ?? 0, completed: completedBy.get(date) ?? 0 };
      });

      const [passed, failed, sums] = await Promise.all([
        tx.quizAttempt.count({ where: { ...where, passed: true } }),
        tx.quizAttempt.count({ where: { ...where, passed: false } }),
        tx.quizAttempt.aggregate({
          where: { ...where, submittedAt: { not: null } },
          _sum: { score: true, total: true },
        }),
      ]);
      const total = sums._sum.total ?? 0;
      return {
        daily,
        quiz:
          passed + failed > 0
            ? {
                passed,
                failed,
                correctPercent:
                  total > 0 ? Math.round(((sums._sum.score ?? 0) / total) * 100) : null,
              }
            : null,
      };
    });
  }

  campaign(ctx: TenantContext, campaignId: string, today: Date): Promise<CampaignActivity | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const campaign = await tx.campaign.findFirst({
        where: { id: campaignId, tenantId: ctx.tenantId, deletedAt: null },
        select: {
          id: true,
          title: true,
          template: { select: { archetype: true } },
        },
      });
      const KINDS = {
        QUIZ: 'quiz',
        SURVEY: 'survey',
        POLL: 'poll',
        VOTE: 'vote',
        GIVEAWAY: 'giveaway',
      } as const;
      const archetype = campaign?.template?.archetype;
      const kind = archetype && archetype in KINDS ? KINDS[archetype as keyof typeof KINDS] : null;
      if (!campaign || !kind) return null;

      const day = (d: Date) => d.toISOString().slice(0, 10);
      const end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      const since = new Date(end.getTime() - (ACTIVITY_DAYS - 1) * 86_400_000);
      const where = { tenantId: ctx.tenantId, campaignId };

      type DayRow = { day: string; n: number };
      const [started, completed, totals] =
        kind === 'quiz'
          ? await Promise.all([
              tx.$queryRaw<DayRow[]>`
                SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
                FROM quiz_attempts
                WHERE tenant_id = ${ctx.tenantId}::uuid AND campaign_id = ${campaignId}::uuid
                  AND started_at >= ${since}
                GROUP BY 1`,
              tx.$queryRaw<DayRow[]>`
                SELECT to_char(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
                FROM quiz_attempts
                WHERE tenant_id = ${ctx.tenantId}::uuid AND campaign_id = ${campaignId}::uuid
                  AND submitted_at >= ${since}
                GROUP BY 1`,
              Promise.all([
                tx.quizAttempt.count({ where }),
                tx.quizAttempt.count({ where: { ...where, submittedAt: { not: null } } }),
              ]),
            ])
          : kind === 'poll' || kind === 'vote'
            ? await (async () => {
                const perDay = await tx.$queryRaw<DayRow[]>`
                  SELECT to_char(cast_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
                  FROM votes
                  WHERE tenant_id = ${ctx.tenantId}::uuid AND campaign_id = ${campaignId}::uuid
                    AND cast_at >= ${since}
                  GROUP BY 1`;
                const n = await tx.vote.count({ where });
                return [perDay, perDay, [n, n]] as const;
              })()
            : kind === 'giveaway'
              ? await (async () => {
                  const perDay = await tx.$queryRaw<DayRow[]>`
                    SELECT to_char(entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
                    FROM giveaway_entries
                    WHERE tenant_id = ${ctx.tenantId}::uuid AND campaign_id = ${campaignId}::uuid
                      AND entered_at >= ${since}
                    GROUP BY 1`;
                  const n = await tx.giveawayEntry.count({ where });
                  return [perDay, perDay, [n, n]] as const;
                })()
              : await Promise.all([
                  tx.$queryRaw<DayRow[]>`
                SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
                FROM survey_responses
                WHERE tenant_id = ${ctx.tenantId}::uuid AND campaign_id = ${campaignId}::uuid
                  AND started_at >= ${since}
                GROUP BY 1`,
                  tx.$queryRaw<DayRow[]>`
                SELECT to_char(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n
                FROM survey_responses
                WHERE tenant_id = ${ctx.tenantId}::uuid AND campaign_id = ${campaignId}::uuid
                  AND submitted_at >= ${since}
                GROUP BY 1`,
                  Promise.all([
                    tx.surveyResponse.count({ where }),
                    tx.surveyResponse.count({ where: { ...where, submittedAt: { not: null } } }),
                  ]),
                ]);

      const startedBy = new Map(started.map((r) => [r.day, r.n]));
      const completedBy = new Map(completed.map((r) => [r.day, r.n]));
      const daily = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
        const date = day(new Date(since.getTime() + i * 86_400_000));
        return { date, started: startedBy.get(date) ?? 0, completed: completedBy.get(date) ?? 0 };
      });

      let quiz: CampaignActivity['quiz'] = null;
      if (kind === 'quiz') {
        const [passed, failed, sums] = await Promise.all([
          tx.quizAttempt.count({ where: { ...where, passed: true } }),
          tx.quizAttempt.count({ where: { ...where, passed: false } }),
          tx.quizAttempt.aggregate({
            where: { ...where, submittedAt: { not: null } },
            _sum: { score: true, total: true },
          }),
        ]);
        const total = sums._sum.total ?? 0;
        quiz = {
          passed,
          failed,
          correctPercent: total > 0 ? Math.round(((sums._sum.score ?? 0) / total) * 100) : null,
        };
      }

      return {
        campaignId: campaign.id,
        title: campaign.title,
        kind,
        started: totals[0],
        completed: totals[1],
        daily,
        quiz,
      };
    });
  }

  list(ctx: TenantContext, query: ListQuery): Promise<ParticipationPage> {
    return withTenant(this.db, ctx, async (tx) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.status
          ? { submittedAt: query.status === 'completed' ? { not: null } : null }
          : {}),
      };
      // Each source is read newest first up to the end of the requested page, then merged: the page is
      // exact without a database view over both tables.
      const take = query.offset + query.limit;
      const include = {
        user: { select: { id: true, name: true } },
        campaign: { select: { id: true, title: true } },
      } as const;
      // A vote or an entry is complete when made, so it is never "in progress".
      const instantWhere =
        query.status === 'in_progress'
          ? null
          : {
              tenantId: ctx.tenantId,
              ...(query.campaignId ? { campaignId: query.campaignId } : {}),
            };
      const none = { tenantId: ctx.tenantId, id: { in: [] as string[] } };
      const [attempts, responses, quizTotal, surveyTotal, votes, entries, voteTotal, entryTotal] =
        await Promise.all([
          tx.quizAttempt.findMany({
            where,
            include,
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            take,
          }),
          tx.surveyResponse.findMany({
            where,
            include,
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            take,
          }),
          tx.quizAttempt.count({ where }),
          tx.surveyResponse.count({ where }),
          tx.vote.findMany({
            where: instantWhere ?? none,
            include: {
              ...include,
              campaign: {
                select: { id: true, title: true, template: { select: { archetype: true } } },
              },
            },
            orderBy: [{ castAt: 'desc' }, { id: 'desc' }],
            take,
          }),
          tx.giveawayEntry.findMany({
            where: instantWhere ?? none,
            include,
            orderBy: [{ enteredAt: 'desc' }, { id: 'desc' }],
            take,
          }),
          tx.vote.count({ where: instantWhere ?? none }),
          tx.giveawayEntry.count({ where: instantWhere ?? none }),
        ]);

      const rows: Participation[] = [
        ...attempts.map((a) => ({
          id: a.id,
          kind: 'quiz' as const,
          participantId: a.user.id,
          name: a.user.name,
          campaignId: a.campaign.id,
          campaignTitle: a.campaign.title,
          attempt: a.attemptNumber,
          status: a.submittedAt ? ('completed' as const) : ('in_progress' as const),
          startedAt: a.startedAt.toISOString(),
          completedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
          result:
            a.submittedAt && a.score !== null && a.total !== null && a.passed !== null
              ? { score: a.score, total: a.total, passed: a.passed }
              : null,
        })),
        ...responses.map((s) => ({
          id: s.id,
          kind: 'survey' as const,
          participantId: s.user.id,
          name: s.user.name,
          campaignId: s.campaign.id,
          campaignTitle: s.campaign.title,
          attempt: 1,
          status: s.submittedAt ? ('completed' as const) : ('in_progress' as const),
          startedAt: s.startedAt.toISOString(),
          completedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
          result: null,
        })),
        ...votes.map((v) => ({
          id: v.id,
          kind: (v.campaign.template?.archetype === 'POLL' ? 'poll' : 'vote') as 'poll' | 'vote',
          participantId: v.user.id,
          name: v.user.name,
          campaignId: v.campaign.id,
          campaignTitle: v.campaign.title,
          attempt: 1,
          status: 'completed' as const,
          startedAt: v.castAt.toISOString(),
          completedAt: v.castAt.toISOString(),
          result: null,
        })),
        ...entries.map((e) => ({
          id: e.id,
          kind: 'giveaway' as const,
          participantId: e.user.id,
          name: e.user.name,
          campaignId: e.campaign.id,
          campaignTitle: e.campaign.title,
          attempt: 1,
          status: 'completed' as const,
          startedAt: e.enteredAt.toISOString(),
          completedAt: e.enteredAt.toISOString(),
          result: null,
        })),
      ].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));

      return {
        items: rows.slice(query.offset, query.offset + query.limit),
        total: quizTotal + surveyTotal + voteTotal + entryTotal,
      };
    });
  }
}
