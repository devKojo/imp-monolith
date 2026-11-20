// Public surface of the my-participations module. Other modules import ONLY from here.
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { requireSession, type IdentityModule } from '@/modules/identity';
import { withParticipant } from '@/shared/database';
import { parse } from '@/shared/http';

export type MyParticipation = {
  campaignId: string;
  title: string;
  /** Null when the campaign has no public address (yet). */
  slug: string | null;
  kind: 'quiz' | 'survey' | 'poll' | 'vote' | 'giveaway';
  /** Finished (submitted) or still in progress. */
  status: 'in_progress' | 'completed';
  startedAt: string;
  submittedAt: string | null;
  /** Quiz only, once scored. */
  score: number | null;
  total: number | null;
  passed: boolean | null;
};

export type MyParticipationsConfig = {
  /** app_runtime client; every query is scoped through withParticipant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export type MyParticipationsPage = { items: MyParticipation[]; total: number };

const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
    offset: z.coerce.number().int().min(0).max(5_000).default(0),
  })
  .strict();

export function createMyParticipationsModule(cfg: MyParticipationsConfig) {
  const list = (userId: string, limit: number, offset: number): Promise<MyParticipationsPage> =>
    withParticipant(cfg.db, userId, async (tx) => {
      // Only participation in a campaign that still exists counts, so the total matches the rows.
      const where = { userId, campaign: { is: { deletedAt: null } } };
      // Four tables, one newest-first list: take enough from each to fill the page after the offset.
      const take = offset + limit;
      const [quizTotal, surveyTotal, voteTotal, entryTotal, attempts, responses, votes, entries] =
        await Promise.all([
          tx.quizAttempt.count({ where }),
          tx.surveyResponse.count({ where }),
          tx.vote.count({ where }),
          tx.giveawayEntry.count({ where }),
          tx.quizAttempt.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            take,
            select: {
              campaignId: true,
              startedAt: true,
              submittedAt: true,
              score: true,
              total: true,
              passed: true,
            },
          }),
          tx.surveyResponse.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            take,
            select: { campaignId: true, startedAt: true, submittedAt: true },
          }),
          tx.vote.findMany({
            where,
            orderBy: { castAt: 'desc' },
            take,
            select: { campaignId: true, castAt: true },
          }),
          tx.giveawayEntry.findMany({
            where,
            orderBy: { enteredAt: 'desc' },
            take,
            select: { campaignId: true, enteredAt: true },
          }),
        ]);
      const ids = [
        ...new Set([...attempts, ...responses, ...votes, ...entries].map((r) => r.campaignId)),
      ];
      const campaigns = new Map(
        (
          await tx.campaign.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              title: true,
              slug: true,
              template: { select: { archetype: true } },
            },
          })
        ).map((c) => [c.id, c]),
      );
      const rows: MyParticipation[] = [];
      const add = (
        kind: MyParticipation['kind'],
        r: { campaignId: string; startedAt: Date; submittedAt: Date | null },
        quiz?: { score: number | null; total: number | null; passed: boolean | null },
      ) => {
        const c = campaigns.get(r.campaignId);
        if (!c) return; // campaign deleted: nothing useful to show
        rows.push({
          campaignId: c.id,
          title: c.title,
          slug: c.slug,
          kind,
          status: r.submittedAt ? 'completed' : 'in_progress',
          startedAt: r.startedAt.toISOString(),
          submittedAt: r.submittedAt?.toISOString() ?? null,
          score: quiz?.score ?? null,
          total: quiz?.total ?? null,
          passed: quiz?.passed ?? null,
        });
      };
      attempts.forEach((a) => add('quiz', a, a));
      responses.forEach((s) => add('survey', s));
      // A vote or an entry is done the moment it is made.
      votes.forEach((v) =>
        add(campaigns.get(v.campaignId)?.template?.archetype === 'POLL' ? 'poll' : 'vote', {
          campaignId: v.campaignId,
          startedAt: v.castAt,
          submittedAt: v.castAt,
        }),
      );
      entries.forEach((e) =>
        add('giveaway', {
          campaignId: e.campaignId,
          startedAt: e.enteredAt,
          submittedAt: e.enteredAt,
        }),
      );
      rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      return {
        items: rows.slice(offset, offset + limit),
        total: quizTotal + surveyTotal + voteTotal + entryTotal,
      };
    });

  const noStore: RequestHandler = (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
  const router = Router();
  router.use(...cfg.identity.guards);
  router.use(noStore);
  // GET /   session   the signed-in person's own participation, newest first (?limit=&offset=)
  router.get('/', requireSession, async (req, res) => {
    const { limit, offset } = parse(querySchema, req.query);
    res.json(await list(req.auth!.userId, limit, offset));
  });

  return { basePath: '/api/v1/me/participations', router, list };
}

export type MyParticipationsModule = ReturnType<typeof createMyParticipationsModule>;
