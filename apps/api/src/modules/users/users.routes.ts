import { Router } from 'express';
import { parse } from '@/shared/http';
import { createUserSchema, userIdParamSchema } from './users.schemas';
import type { UsersService } from './users.service';

export function usersRouter(service: UsersService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list());
  });
  r.get('/:id', async (req, res) => {
    const { id } = parse(userIdParamSchema, req.params);
    res.json(await service.get(id));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(parse(createUserSchema, req.body)));
  });
  return r;
}
