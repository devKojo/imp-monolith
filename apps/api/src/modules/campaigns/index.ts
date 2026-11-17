// Public surface of the campaigns module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { CampaignsService } from './application/campaigns.service';
import type { TemplateLookup } from './application/ports';
import { PublicDiscoveryService } from './application/public-discovery.service';
import { campaignsRouter } from './http/campaigns.routes';
import { publicCampaignsRouter } from './http/public.routes';
import { PrismaCampaignRepository } from './infrastructure/prisma-campaign.repository';
import { PrismaPublicCampaignRepository } from './infrastructure/prisma-public-campaigns.repository';

export type { CampaignDetail, CampaignStatus, CampaignSummary } from './domain/model';
export type { PublicCampaign, PublicCampaignDetail, PublicType } from './domain/public';
export type { TemplateLookup } from './application/ports';
export type { CampaignField, FieldKind } from './domain/fields';
export { CampaignFullError } from './domain/errors';
export { claimSeat } from './infrastructure/participant-seats';
export { poolOf } from './domain/pool';
export { canManageCampaigns, canOperateCampaigns, canReadCampaigns } from './domain/permissions';

export type CampaignsConfig = {
  /** app_runtime client; every query is scoped through withTenant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
  /** The built-in campaign types, from the templates module. */
  templates: TemplateLookup;
};

export function createCampaignsModule(cfg: CampaignsConfig) {
  const service = new CampaignsService(new PrismaCampaignRepository(cfg.db), cfg.templates);
  return {
    basePath: '/api/v1/campaigns',
    router: campaignsRouter(service, cfg.identity.guards),
    service,
    /** The public listing of running campaigns: no session, cacheable. */
    publicBasePath: '/api/v1/public/campaigns',
    publicRouter: publicCampaignsRouter(
      new PublicDiscoveryService(new PrismaPublicCampaignRepository(cfg.db)),
    ),
  };
}

export type CampaignsModule = ReturnType<typeof createCampaignsModule>;
