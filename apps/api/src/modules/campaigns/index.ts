// Public surface of the campaigns module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { CampaignsService } from './application/campaigns.service';
import type { QuestionCounter, TemplateLookup } from './application/ports';
import { PublicDiscoveryService } from './application/public-discovery.service';
import { campaignsRouter } from './http/campaigns.routes';
import { publicCampaignsRouter } from './http/public.routes';
import { PrismaCampaignRepository } from './infrastructure/prisma-campaign.repository';
import { PrismaPublicCampaignRepository } from './infrastructure/prisma-public-campaigns.repository';

export { PrismaCampaignUsage } from './infrastructure/prisma-campaign-usage';
export type { CampaignDetail, CampaignStatus, CampaignSummary } from './domain/model';
export type { PublicCampaign, PublicType } from './domain/public';
export type { QuestionCounter, TemplateLookup } from './application/ports';
export { canManageCampaigns, canOperateCampaigns, canReadCampaigns } from './domain/permissions';

export type CampaignsConfig = {
  /** app_runtime client; every query is scoped through withTenant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
  /** The templates a campaign uses, from the templates module. */
  templates: TemplateLookup;
  /** The quiz questions of a campaign, from the quiz module; a quiz needs one to launch. */
  questions?: QuestionCounter;
};

export function createCampaignsModule(cfg: CampaignsConfig) {
  const service = new CampaignsService(
    new PrismaCampaignRepository(cfg.db),
    cfg.templates,
    undefined,
    undefined,
    cfg.questions,
  );
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
