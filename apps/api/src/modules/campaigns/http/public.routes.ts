import { Router } from 'express';
import { z } from 'zod';
import { parse } from '@/shared/http';
import type { PublicDiscoveryService } from '../application/public-discovery.service';
import { PUBLIC_TYPES } from '../domain/public';

const slugSchema = z
  .object({
    slug: z
      .string()
      .max(80)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  })
  .strict();

const querySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    type: z.enum(PUBLIC_TYPES).optional(),
    cursor: z.string().max(300).optional(),
  })
  .strict();

/**
 * Public and cacheable (R-WEB-05): no session, no cookies, no per-user fields. The same response is
 * safe to share between visitors, so it is cached at the edge for a short time.
 *
 *   GET /        public (the listing)
 *   GET /:slug   public (one campaign)
 */
export function publicCampaignsRouter(service: PublicDiscoveryService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const result = await service.list(parse(querySchema, req.query));
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.json(result);
  });
  r.get('/:slug', async (req, res) => {
    const { slug } = parse(slugSchema, req.params);
    const campaign = await service.get(slug);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.json(campaign);
  });
  return r;
}
