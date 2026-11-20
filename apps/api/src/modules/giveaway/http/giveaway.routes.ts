import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { GiveawayService } from '../application/giveaway.service';
import { slugParamSchema } from '../contracts/giveaway.schemas';
import type { Participant } from '../domain/model';

const participantOf = (req: Request): Participant | null =>
  req.auth ? { userId: req.auth.userId, accountType: req.auth.accountType } : null;

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Entering a giveaway (a participant). The business is found from the campaign's public address.
 *
 *   GET  /:slug         session         the participant's own ticket, if any
 *   POST /:slug/entry   session + csrf  enter, or return the ticket already held
 */
export function giveawayRouter(service: GiveawayService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);
  r.get('/:slug', requireSession, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.current(participantOf(req), slug));
  });
  r.post('/:slug/entry', requireSession, requireCsrfToken, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.join(participantOf(req), slug));
  });
  return r;
}

/**
 * What a visitor may know before signing in: the title, when it closes and how many have entered. Public
 * and cacheable, with no session and no cookies.
 *
 *   GET /:slug   public
 */
export function publicGiveawayRouter(service: GiveawayService): Router {
  const r = Router();
  r.get('/:slug', async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    const info = await service.publicInfo(slug);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.json(info);
  });
  return r;
}
