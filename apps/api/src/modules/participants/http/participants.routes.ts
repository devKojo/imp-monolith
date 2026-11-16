import { Router, type Request, type RequestHandler } from 'express';
import { requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { ParticipantsService } from '../application/participants.service';
import { campaignParamSchema, listQuerySchema } from '../contracts/participants.schemas';
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
 * Read-only, for the signed-in business. Never cached: it holds personal data.
 *
 *   GET /summary   session   counts, and counts per campaign
 *   GET /activity  session   the whole business over the last 14 days, and quiz outcomes
 *   GET /campaigns/:campaignId   session   how one campaign is going: totals, last 14 days, quiz outcome
 *   GET /          session   participation, newest first (?campaignId=&status=&limit=&offset=)
 */
export function participantsRouter(service: ParticipantsService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);

  r.get('/summary', requireSession, async (req, res) => {
    res.json(await service.summary(actorOf(req)));
  });

  r.get('/activity', requireSession, async (req, res) => {
    res.json(await service.activity(actorOf(req)));
  });

  r.get('/campaigns/:campaignId', requireSession, async (req, res) => {
    const { campaignId } = parse(campaignParamSchema, req.params);
    res.json(await service.campaign(actorOf(req), campaignId));
  });

  r.get('/', requireSession, async (req, res) => {
    res.json(await service.list(actorOf(req), parse(listQuerySchema, req.query)));
  });

  return r;
}
