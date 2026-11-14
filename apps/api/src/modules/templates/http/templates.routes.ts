import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { TemplatesService } from '../application/templates.service';
import {
  createTemplateSchema,
  duplicateTemplateSchema,
  idParamSchema,
  listQuerySchema,
  updateTemplateSchema,
  versionedSchema,
} from '../contracts/templates.schemas';
import type { Actor } from '../domain/model';

/** The acting person: from the session's active membership, never from the request body. */
const actorOf = (req: Request): Actor | null =>
  req.auth?.active
    ? { userId: req.auth.userId, tenantId: req.auth.active.tenantId, role: req.auth.active.role }
    : null;

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Handlers only parse (Zod), authorise (declared requirement) and call one service method
 * (R-ARC-08). `guards` resolve the session and check the Origin; tests pass stand-ins.
 *
 * Declared access per route (R-IAM-06): the role check itself lives in the service.
 *   GET    /                    session
 *   GET    /:id                 session
 *   POST   /                    session + csrf   (manage)
 *   PUT    /:id                 session + csrf   (manage)
 *   POST   /:id/publish         session + csrf   (manage)
 *   POST   /:id/unpublish       session + csrf   (manage)
 *   POST   /:id/duplicate       session + csrf   (manage)
 *   DELETE /:id                 session + csrf   (manage)
 */
export function templatesRouter(service: TemplatesService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);

  r.get('/', requireSession, async (req, res) => {
    res.json({ items: await service.list(actorOf(req), parse(listQuerySchema, req.query)) });
  });

  r.get('/:id', requireSession, async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    res.json(await service.get(actorOf(req), id));
  });

  r.post('/', requireSession, requireCsrfToken, async (req, res) => {
    const body = parse(createTemplateSchema, req.body);
    res.status(201).json(await service.create(actorOf(req), body));
  });

  r.put('/:id', requireSession, requireCsrfToken, async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    res.json(await service.update(actorOf(req), id, parse(updateTemplateSchema, req.body)));
  });

  r.post('/:id/publish', requireSession, requireCsrfToken, async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const { expectedVersion } = parse(versionedSchema, req.body);
    res.json(await service.publish(actorOf(req), id, expectedVersion));
  });

  r.post('/:id/unpublish', requireSession, requireCsrfToken, async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const { expectedVersion } = parse(versionedSchema, req.body);
    res.json(await service.unpublish(actorOf(req), id, expectedVersion));
  });

  r.post('/:id/duplicate', requireSession, requireCsrfToken, async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    const { name } = parse(duplicateTemplateSchema, req.body ?? {});
    res.status(201).json(await service.duplicate(actorOf(req), id, name));
  });

  r.delete('/:id', requireSession, requireCsrfToken, async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    await service.remove(actorOf(req), id);
    res.status(204).end();
  });

  return r;
}
