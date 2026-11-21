import { Router, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { AdministrationService } from '../application/administration.service';
import {
  awardParamSchema,
  decisionBodySchema,
  pageQuerySchema,
  reportParamSchema,
  reportsQuerySchema,
  resolveBodySchema,
} from '../contracts/administration.schemas';

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Platform review (platform staff only; the service checks it on every call). Never cached: it holds
 * personal data. Staff sign in like anyone else; nothing here is reachable by being a business owner.
 *
 *   GET  /me                          session          whether the signed-in person is platform staff
 *   GET  /reviews                     session          awards waiting for review or held, riskiest first
 *   GET  /reports                     session          scam reports (?status=OPEN|REVIEWED|DISMISSED)
 *   POST /awards/:awardId/decision    session + csrf   release, reject or revoke (password required)
 *   POST /reports/:reportId/resolve   session + csrf   mark a report reviewed or dismissed
 */
export function administrationRouter(
  service: AdministrationService,
  guards: RequestHandler[],
): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);

  r.get('/me', requireSession, async (req, res) => {
    res.json(await service.me(req.auth ?? null));
  });

  r.get('/reviews', requireSession, async (req, res) => {
    res.json(await service.queue(req.auth ?? null, parse(pageQuerySchema, req.query)));
  });

  r.get('/reports', requireSession, async (req, res) => {
    res.json(await service.reports(req.auth ?? null, parse(reportsQuerySchema, req.query)));
  });

  r.post('/awards/:awardId/decision', requireSession, requireCsrfToken, async (req, res) => {
    const { awardId } = parse(awardParamSchema, req.params);
    res.json(
      await service.decide(req.auth ?? null, awardId, parse(decisionBodySchema, req.body ?? {})),
    );
  });

  r.post('/reports/:reportId/resolve', requireSession, requireCsrfToken, async (req, res) => {
    const { reportId } = parse(reportParamSchema, req.params);
    res.json(
      await service.resolve(req.auth ?? null, reportId, parse(resolveBodySchema, req.body ?? {})),
    );
  });

  return r;
}
