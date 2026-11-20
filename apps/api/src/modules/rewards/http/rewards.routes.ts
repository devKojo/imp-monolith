import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { RewardsService } from '../application/rewards.service';
import { campaignParamSchema, drawParamSchema } from '../contracts/rewards.schemas';
import type { Actor } from '../domain/model';

/** The acting person: from the session's active membership, never from the request. */
const actorOf = (req: Request): Actor | null =>
  req.auth?.active
    ? { userId: req.auth.userId, tenantId: req.auth.active.tenantId, role: req.auth.active.role }
    : null;

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Settling a campaign (the signed-in business). Never cached: it holds personal data.
 *
 *   POST /campaigns/:campaignId/draw/seal   session + csrf   fix the draw's rules before the campaign closes
 *   POST /campaigns/:campaignId/award       session + csrf   settle an ended campaign (once)
 *   GET  /campaigns/:campaignId/awards      session          who was awarded what, and where each stands
 */
export function rewardsRouter(service: RewardsService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);

  r.post('/campaigns/:campaignId/draw/seal', requireSession, requireCsrfToken, async (req, res) => {
    const { campaignId } = parse(campaignParamSchema, req.params);
    res.json(await service.seal(actorOf(req), campaignId));
  });

  r.post('/campaigns/:campaignId/award', requireSession, requireCsrfToken, async (req, res) => {
    const { campaignId } = parse(campaignParamSchema, req.params);
    res.status(201).json(await service.award(actorOf(req), campaignId));
  });

  r.get('/campaigns/:campaignId/awards', requireSession, async (req, res) => {
    const { campaignId } = parse(campaignParamSchema, req.params);
    res.json({ items: await service.awards(actorOf(req), campaignId) });
  });

  return r;
}

/**
 * A made draw, for anyone to verify. Public and cacheable: it names nobody (entrants are one-way
 * references) and does not change once made.
 *
 *   GET /draws/:drawId   public
 */
export function publicRewardsRouter(service: RewardsService): Router {
  const r = Router();
  r.get('/draws/:drawId', async (req, res) => {
    const { drawId } = parse(drawParamSchema, req.params);
    const draw = await service.publicDraw(drawId);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(draw);
  });
  return r;
}
