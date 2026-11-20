// Public surface of the giveaway module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { GiveawayService } from './application/giveaway.service';
import { giveawayRouter, publicGiveawayRouter } from './http/giveaway.routes';
import { PrismaGiveawayRepository } from './infrastructure/prisma-giveaway.repository';

export type { GiveawayInfo, GiveawayView } from './domain/model';

export type GiveawayConfig = {
  /** app_runtime client; every query is scoped through withTenant / withPublic. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createGiveawayModule(cfg: GiveawayConfig) {
  const service = new GiveawayService(new PrismaGiveawayRepository(cfg.db));
  return {
    /** Participants enter. */
    basePath: '/api/v1/giveaway',
    router: giveawayRouter(service, cfg.identity.guards),
    /** Visitors read the facts before signing in. */
    publicBasePath: '/api/v1/public/giveaway',
    publicRouter: publicGiveawayRouter(service),
    service,
  };
}

export type GiveawayModule = ReturnType<typeof createGiveawayModule>;
