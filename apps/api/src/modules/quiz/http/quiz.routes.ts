import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { QuizService } from '../application/quiz.service';
import { answerParamSchema, answerSchema, slugParamSchema } from '../contracts/quiz.schemas';
import type { Participant } from '../domain/model';

const participantOf = (req: Request): Participant | null =>
  req.auth ? { userId: req.auth.userId, accountType: req.auth.accountType } : null;

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Taking a quiz (a participant). The business is found from the campaign's public address.
 *
 *   POST /:slug/attempt                        session + csrf   start, or resume
 *   GET  /:slug/attempt                        session
 *   PUT  /:slug/attempt/answers/:questionId    session + csrf
 *   POST /:slug/attempt/submit                 session + csrf
 */
export function quizParticipationRouter(service: QuizService, guards: RequestHandler[]): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);
  r.post('/:slug/attempt', requireSession, requireCsrfToken, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.start(participantOf(req), slug));
  });
  r.get('/:slug/attempt', requireSession, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.current(participantOf(req), slug));
  });
  r.put(
    '/:slug/attempt/answers/:questionId',
    requireSession,
    requireCsrfToken,
    async (req, res) => {
      const { slug, questionId } = parse(answerParamSchema, req.params);
      const { choiceIndex } = parse(answerSchema, req.body);
      await service.answer(participantOf(req), slug, questionId, choiceIndex);
      res.status(204).end();
    },
  );
  r.post('/:slug/attempt/submit', requireSession, requireCsrfToken, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.submit(participantOf(req), slug));
  });
  return r;
}

/**
 * What a visitor may know before starting: the title, the number of questions and the rules. Public and
 * cacheable, with no session and no cookies; it never includes a question.
 *
 *   GET /:slug   public
 */
export function publicQuizRouter(service: QuizService): Router {
  const r = Router();
  r.get('/:slug', async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    const info = await service.info(slug);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.json(info);
  });
  return r;
}
