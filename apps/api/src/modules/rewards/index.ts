// Public surface of the rewards module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { RewardsService } from './application/rewards.service';
import { publicRewardsRouter, rewardsRouter } from './http/rewards.routes';
import { PrismaRewardsRepository } from './infrastructure/prisma-rewards.repository';

export type { AwardResult, AwardRow, DrawView, PublishedDraw } from './domain/model';
export { verifyDraw } from './domain/draw';
export { appendPoints, pointsBalance } from './infrastructure/points-ledger';

export type RewardsConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createRewardsModule(cfg: RewardsConfig) {
  const service = new RewardsService(new PrismaRewardsRepository(cfg.db));
  return {
    /** The business settles its campaigns. */
    basePath: '/api/v1/rewards',
    router: rewardsRouter(service, cfg.identity.guards),
    /** Anyone can verify a made draw. */
    publicBasePath: '/api/v1/public/rewards',
    publicRouter: publicRewardsRouter(service),
    service,
  };
}

export type RewardsModule = ReturnType<typeof createRewardsModule>;
