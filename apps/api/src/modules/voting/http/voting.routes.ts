import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { VotingService } from '../application/voting.service';
import { campaignParamSchema, slugParamSchema, voteSchema } from '../contracts/voting.schemas';
import type { Actor, Participant } from '../domain/model';

const participantOf = (req: Request): Participant | null =>
  req.auth ? { userId: req.auth.userId, accountType: req.auth.accountType } : null;

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
 * Voting in a poll or an image vote (a participant), and reading the standings (a business). The business is
 * found from the campaign's public address for a participant, and from the session for a business.
 *
 *   GET  /campaigns/:campaignId/results   session   the business's own standings
 *   GET  /:slug                           session   options, own vote, standings when allowed
 *   POST /:slug/vote                      session + csrf   { optionIndex }; one vote, final
 */
export function votingRouter(service: VotingService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);
  r.get('/campaigns/:campaignId/results', requireSession, async (req, res) => {
    const { campaignId } = parse(campaignParamSchema, req.params);
    res.json(await service.results(actorOf(req), campaignId));
  });
  r.get('/:slug', requireSession, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.current(participantOf(req), slug));
  });
  r.post('/:slug/vote', requireSession, requireCsrfToken, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    const { optionIndex } = parse(voteSchema, req.body);
    res.json(await service.cast(participantOf(req), slug, optionIndex));
  });
  return r;
}

/**
 * What a visitor may know before signing in: the title, the question and how many options there are. Public
 * and cacheable, with no session and no cookies; it never includes the standings.
 *
 *   GET /:slug   public
 */
export function publicVotingRouter(service: VotingService): Router {
  const r = Router();
  r.get('/:slug', async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    const info = await service.info(slug);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.json(info);
  });
  return r;
}
