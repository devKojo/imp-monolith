// Public surface of the quiz module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import type { TenantContext } from '@/shared/database';
import { QuizService } from './application/quiz.service';
import { publicQuizRouter, quizAuthoringRouter, quizParticipationRouter } from './http/quiz.routes';
import { PrismaQuizRepository } from './infrastructure/prisma-quiz.repository';

export type { QuizInfo, AttemptView, QuizDefinition } from './domain/model';

export type QuizConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createQuizModule(cfg: QuizConfig) {
  const repo = new PrismaQuizRepository(cfg.db);
  const service = new QuizService(repo);
  return {
    /** Business users write the questions of a draft campaign. */
    authoringBasePath: '/api/v1/quizzes',
    authoringRouter: quizAuthoringRouter(service, cfg.identity.guards),
    /** Participants take the quiz. */
    participationBasePath: '/api/v1/quiz',
    participationRouter: quizParticipationRouter(service, cfg.identity.guards),
    /** Visitors read the rules before starting. */
    publicBasePath: '/api/v1/public/quiz',
    publicRouter: publicQuizRouter(service),
    service,
    /** For the campaigns module: how many questions a quiz campaign has (launch needs at least one). */
    questions: {
      count: (ctx: TenantContext, campaignId: string) => repo.questionCount(ctx, campaignId),
    },
  };
}

export type QuizModule = ReturnType<typeof createQuizModule>;
