import { Router, type Request, type RequestHandler } from 'express';
import { requireCsrfToken, requireSession } from '@/modules/identity';
import { parse } from '@/shared/http';
import type { SurveyService } from '../application/survey.service';
import { answerParamSchema, answerSchema, slugParamSchema } from '../contracts/survey.schemas';
import type { Participant } from '../domain/model';

const participantOf = (req: Request): Participant | null =>
  req.auth ? { userId: req.auth.userId, accountType: req.auth.accountType } : null;

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Taking a survey (a participant). The business is found from the campaign's public address.
 *
 *   POST /:slug/response                        session + csrf   start, or resume
 *   GET  /:slug/response                        session
 *   PUT  /:slug/response/answers/:questionId    session + csrf   { choiceIndex } or { text }; empty text clears
 *   POST /:slug/response/submit                 session + csrf
 */
export function surveyParticipationRouter(
  service: SurveyService,
  guards: RequestHandler[],
): Router {
  const r = Router();
  r.use(...guards);
  r.use(noStore);
  r.post('/:slug/response', requireSession, requireCsrfToken, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.start(participantOf(req), slug));
  });
  r.get('/:slug/response', requireSession, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.current(participantOf(req), slug));
  });
  r.put(
    '/:slug/response/answers/:questionId',
    requireSession,
    requireCsrfToken,
    async (req, res) => {
      const { slug, questionId } = parse(answerParamSchema, req.params);
      await service.answer(participantOf(req), slug, questionId, parse(answerSchema, req.body));
      res.status(204).end();
    },
  );
  r.post('/:slug/response/submit', requireSession, requireCsrfToken, async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    res.json(await service.submit(participantOf(req), slug));
  });
  return r;
}

/**
 * What a visitor may know before starting: the title, the number of questions and a time estimate. Public
 * and cacheable, with no session and no cookies; it never includes a question.
 *
 *   GET /:slug   public
 */
export function publicSurveyRouter(service: SurveyService): Router {
  const r = Router();
  r.get('/:slug', async (req, res) => {
    const { slug } = parse(slugParamSchema, req.params);
    const info = await service.info(slug);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.json(info);
  });
  return r;
}
