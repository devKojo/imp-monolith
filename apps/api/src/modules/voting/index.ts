// Public surface of the voting module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { VotingService } from './application/voting.service';
import { publicVotingRouter, votingRouter } from './http/voting.routes';
import { PrismaVotingRepository } from './infrastructure/prisma-voting.repository';

export type { BallotInfo, BallotView, CampaignResults, Results } from './domain/model';

export type VotingConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createVotingModule(cfg: VotingConfig) {
  const service = new VotingService(new PrismaVotingRepository(cfg.db));
  return {
    /** Participants vote; a business reads its own standings. */
    basePath: '/api/v1/voting',
    router: votingRouter(service, cfg.identity.guards),
    /** Visitors read the facts before signing in. */
    publicBasePath: '/api/v1/public/voting',
    publicRouter: publicVotingRouter(service),
    service,
  };
}

export type VotingModule = ReturnType<typeof createVotingModule>;
