// Public surface of the rewards module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { MyRewardsService } from './application/my-rewards.service';
import { RewardsService } from './application/rewards.service';
import { myRewardsRouter, publicRewardsRouter, rewardsRouter } from './http/rewards.routes';
import { AttemptLimiter } from './infrastructure/attempt-limiter';
import { PrismaMyRewardsRepository } from './infrastructure/prisma-my-rewards.repository';
import { PrismaRewardsRepository } from './infrastructure/prisma-rewards.repository';
import { SecretBox } from './infrastructure/secret-box';

export type { AwardResult, AwardRow, DrawView, PublishedDraw } from './domain/model';
export { verifyDraw } from './domain/draw';
export { appendPoints, pointsBalance } from './infrastructure/points-ledger';
export { SecretBox } from './infrastructure/secret-box';
export type { MyAward, MyAwardDetail, MyAwardsPage, WalletBalance } from './domain/model';

export type RewardsConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards' | 'auth'>;
  /** Server secret that encrypts payout destinations (at least 16 characters). Required in production. */
  dataKey?: string | undefined;
};

export function createRewardsModule(cfg: RewardsConfig) {
  const box = new SecretBox(cfg.dataKey ?? 'development-only-rewards-data-key');
  const service = new RewardsService(new PrismaRewardsRepository(cfg.db), box);
  const mine = new MyRewardsService(
    new PrismaMyRewardsRepository(cfg.db),
    box,
    (who, password) => cfg.identity.auth.confirmPassword(who, password),
    new AttemptLimiter(15, 60 * 60 * 1000), // claim attempts per person / hour
  );
  return {
    /** The business settles its campaigns. */
    basePath: '/api/v1/rewards',
    router: rewardsRouter(service, cfg.identity.guards),
    /** A participant's own rewards and claiming them. */
    mineBasePath: '/api/v1/my-rewards',
    mineRouter: myRewardsRouter(mine, cfg.identity.guards),
    /** Anyone can verify a made draw. */
    publicBasePath: '/api/v1/public/rewards',
    publicRouter: publicRewardsRouter(service),
    service,
    mine,
    box,
  };
}

export type RewardsModule = ReturnType<typeof createRewardsModule>;
