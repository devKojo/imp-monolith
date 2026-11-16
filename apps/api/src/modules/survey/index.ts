// Public surface of the survey module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { SurveyService } from './application/survey.service';
import { publicSurveyRouter, surveyParticipationRouter } from './http/survey.routes';
import { PrismaSurveyRepository } from './infrastructure/prisma-survey.repository';

export type { SurveyInfo, ResponseView } from './domain/model';

export type SurveyConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createSurveyModule(cfg: SurveyConfig) {
  const service = new SurveyService(new PrismaSurveyRepository(cfg.db));
  return {
    /** Participants take the survey. */
    participationBasePath: '/api/v1/survey',
    participationRouter: surveyParticipationRouter(service, cfg.identity.guards),
    /** Visitors read the facts before starting. */
    publicBasePath: '/api/v1/public/survey',
    publicRouter: publicSurveyRouter(service),
    service,
  };
}

export type SurveyModule = ReturnType<typeof createSurveyModule>;
