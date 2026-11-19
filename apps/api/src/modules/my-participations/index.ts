// Public surface of the my-participations module. Other modules import ONLY from here.
import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '@/generated/prisma/client';
import { requireSession, type IdentityModule } from '@/modules/identity';
import { withParticipant } from '@/shared/database';

export type MyParticipation = {
  campaignId: string;
  title: string;
  /** Null when the campaign has no public address (yet). */
  slug: string | null;
  kind: 'quiz' | 'survey';
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

const LIMIT = 100;

export function createMyParticipationsModule(cfg: MyParticipationsConfig) {
  const list = (userId: string): Promise<MyParticipation[]> =>
    withParticipant(cfg.db, userId, async (tx) => {
      const where = { userId };
      const [attempts, responses] = await Promise.all([
        tx.quizAttempt.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          take: LIMIT,
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
          take: LIMIT,
          select: { campaignId: true, startedAt: true, submittedAt: true },
        }),
      ]);
      const ids = [...new Set([...attempts, ...responses].map((r) => r.campaignId))];
      const campaigns = new Map(
        (
          await tx.campaign.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true, slug: true },
          })
        ).map((c) => [c.id, c]),
      );
      const rows: MyParticipation[] = [];
      const add = (
        kind: 'quiz' | 'survey',
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
      return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, LIMIT);
    });

  const noStore: RequestHandler = (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
  const router = Router();
  router.use(...cfg.identity.guards);
  router.use(noStore);
  // GET /   session   the signed-in person's own participation, newest first
  router.get('/', requireSession, async (req, res) => {
    res.json({ items: await list(req.auth!.userId) });
  });

  return { basePath: '/api/v1/me/participations', router, list };
}

export type MyParticipationsModule = ReturnType<typeof createMyParticipationsModule>;
