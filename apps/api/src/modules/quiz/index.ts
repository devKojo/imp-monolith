// Public surface of the quiz module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { QuizService } from './application/quiz.service';
import { publicQuizRouter, quizParticipationRouter } from './http/quiz.routes';
import { PrismaQuizRepository } from './infrastructure/prisma-quiz.repository';

export type { QuizInfo, AttemptView } from './domain/model';

export type QuizConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createQuizModule(cfg: QuizConfig) {
  const service = new QuizService(new PrismaQuizRepository(cfg.db));
  return {
    /** Participants take the quiz. */
    participationBasePath: '/api/v1/quiz',
    participationRouter: quizParticipationRouter(service, cfg.identity.guards),
    /** Visitors read the rules before starting. */
    publicBasePath: '/api/v1/public/quiz',
    publicRouter: publicQuizRouter(service),
    service,
  };
}

export type QuizModule = ReturnType<typeof createQuizModule>;
