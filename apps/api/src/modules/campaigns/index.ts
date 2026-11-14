// Public surface of the campaigns module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { CampaignsService } from './application/campaigns.service';
import type { TemplateLookup } from './application/ports';
import { campaignsRouter } from './http/campaigns.routes';
import { PrismaCampaignRepository } from './infrastructure/prisma-campaign.repository';

export { PrismaCampaignUsage } from './infrastructure/prisma-campaign-usage';
export type { CampaignDetail, CampaignStatus, CampaignSummary } from './domain/model';
export type { TemplateLookup } from './application/ports';
export { canManageCampaigns, canOperateCampaigns, canReadCampaigns } from './domain/permissions';

export type CampaignsConfig = {
  /** app_runtime client; every query is scoped through withTenant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
  /** The templates a campaign uses, from the templates module. */
  templates: TemplateLookup;
};

export function createCampaignsModule(cfg: CampaignsConfig) {
  const service = new CampaignsService(new PrismaCampaignRepository(cfg.db), cfg.templates);
  return {
    basePath: '/api/v1/campaigns',
    router: campaignsRouter(service, cfg.identity.guards),
    service,
  };
}

export type CampaignsModule = ReturnType<typeof createCampaignsModule>;
