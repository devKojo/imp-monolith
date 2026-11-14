import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireSession } from '@/modules/identity';
import { canReadCampaigns } from '@/modules/campaigns';
import { AppError } from '@/shared/errors';
import { parse } from '@/shared/http';
import { uuidSchema } from '@/shared/uuid';
import type { TemplatesService } from '../application/templates.service';

const idParam = z.object({ id: uuidSchema }).strict();

/** Anyone who can see campaigns can see the types they are made from. */
const businessOnly: RequestHandler = (req, _res, next) => {
  const role = req.auth?.active?.role;
  if (!role || !canReadCampaigns(role)) {
    throw new AppError('Your role cannot see campaign types', 403, 'FORBIDDEN');
  }
  next();
};

/**
 * Read-only: the built-in campaign types and what each one allows. Businesses cannot create or change
 * them; they are seeded now and will be managed by platform admins.
 *
 *   GET /       session (business)
 *   GET /:id    session (business)
 */
export function templatesRouter(service: TemplatesService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  r.get('/', requireSession, businessOnly, async (_req, res) => {
    res.json({ items: await service.list() });
  });

  r.get('/:id', requireSession, businessOnly, async (req, res) => {
    const { id } = parse(idParam, req.params);
    res.json(await service.get(id));
  });
  return r;
}
