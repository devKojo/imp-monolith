// Public surface of the participants module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { ParticipantsService } from './application/participants.service';
import { participantsRouter } from './http/participants.routes';
import { PrismaParticipantsRepository } from './infrastructure/prisma-participants.repository';

export type {
  BusinessActivity,
  CampaignActivity,
  CampaignParticipation,
  ParticipantSummary,
  Participation,
  ParticipationPage,
} from './domain/model';
export { canViewParticipants } from './domain/permissions';

export type ParticipantsConfig = {
  /** app_runtime client; every query is scoped through withTenant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createParticipantsModule(cfg: ParticipantsConfig) {
  const service = new ParticipantsService(new PrismaParticipantsRepository(cfg.db));
  return {
    basePath: '/api/v1/participants',
    router: participantsRouter(service, cfg.identity.guards),
    service,
  };
}

export type ParticipantsModule = ReturnType<typeof createParticipantsModule>;
