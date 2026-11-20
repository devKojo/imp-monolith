import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { MyRewardsService } from '../application/my-rewards.service';
import type { RewardsService } from '../application/rewards.service';
import {
  awardParamSchema,
  campaignParamSchema,
  claimBodySchema,
  drawParamSchema,
  fulfilBodySchema,
  myListQuerySchema,
} from '../contracts/rewards.schemas';
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
 *   GET  /campaigns/:campaignId/awards/export  session       the same as a CSV (no destinations)
 *   GET  /awards/:awardId/destination       session          where to send it (decrypted; each view is recorded)
 *   POST /awards/:awardId/fulfil            session + csrf   record that it was paid or sent, with a reference
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

  r.get('/campaigns/:campaignId/awards/export', requireSession, async (req, res) => {
    const { campaignId } = parse(campaignParamSchema, req.params);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="awards.csv"');
    res.send(await service.awardsCsv(actorOf(req), campaignId));
  });

  r.get('/awards/:awardId/destination', requireSession, async (req, res) => {
    const { awardId } = parse(awardParamSchema, req.params);
    res.json(await service.destination(actorOf(req), awardId));
  });

  r.post('/awards/:awardId/fulfil', requireSession, requireCsrfToken, async (req, res) => {
    const { awardId } = parse(awardParamSchema, req.params);
    const { reference } = parse(fulfilBodySchema, req.body ?? {});
    res.json(await service.fulfil(actorOf(req), awardId, reference));
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

/**
 * A participant's own rewards. Never cached: it holds personal data. The person is the session's, never the
 * request's.
 *
 *   GET  /            session         my awards, newest first (?limit=&offset=)
 *   GET  /wallet      session         points held with each business
 *   GET  /:awardId    session         one award with its history
 *   POST /:awardId/claim  session + csrf   claim it (money and items also need a destination and the password)
 */
export function myRewardsRouter(service: MyRewardsService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);

  r.get('/', requireSession, async (req, res) => {
    res.json(await service.list(req.auth ?? null, parse(myListQuerySchema, req.query)));
  });

  // Before '/:awardId', or "wallet" would be read as an id.
  r.get('/wallet', requireSession, async (req, res) => {
    res.json(await service.wallet(req.auth ?? null));
  });

  r.get('/:awardId', requireSession, async (req, res) => {
    const { awardId } = parse(awardParamSchema, req.params);
    res.json(await service.get(req.auth ?? null, awardId));
  });

  r.post('/:awardId/claim', requireSession, requireCsrfToken, async (req, res) => {
    const { awardId } = parse(awardParamSchema, req.params);
    res.json(
      await service.claim(req.auth ?? null, awardId, parse(claimBodySchema, req.body ?? {})),
    );
  });

  return r;
}
