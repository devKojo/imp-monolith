// Public surface of the templates module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import type { TenantContext } from '@/shared/database';
import type { TemplateUsage } from './application/ports';
import { TemplatesService } from './application/templates.service';
import { templatesRouter } from './http/templates.routes';
import { PrismaTemplateRepository } from './infrastructure/prisma-template.repository';

export type {
  Archetype,
  FieldKind,
  TemplateDetail,
  TemplateStatus,
  TemplateSummary,
} from './domain/model';
export type { TemplateUsage } from './application/ports';
export { canManageTemplates, canReadTemplates } from './domain/permissions';

export type TemplatesConfig = {
  /** app_runtime client; every query is scoped through withTenant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
  /** Whether a template is in use by something running (campaigns); blocks unpublish and delete. */
  usage?: TemplateUsage;
};

export function createTemplatesModule(cfg: TemplatesConfig) {
  const service = new TemplatesService(new PrismaTemplateRepository(cfg.db), cfg.usage);
  return {
    basePath: '/api/v1/templates',
    router: templatesRouter(service, cfg.identity.guards),
    service,
    /** For the campaigns module: the templates a campaign uses, without their fields. */
    lookup: {
      many: async (ctx: TenantContext, ids: readonly string[]) =>
        (await service.summariesFor(ctx, ids)).map((t) => ({
          id: t.id,
          name: t.name,
          archetype: t.archetype,
          status: t.status,
        })),
    },
  };
}

export type TemplatesModule = ReturnType<typeof createTemplatesModule>;
