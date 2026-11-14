// Public surface of the templates module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { TemplatesService } from './application/templates.service';
import { templatesRouter } from './http/templates.routes';
import { PrismaTemplateRepository } from './infrastructure/prisma-template.repository';

export type { Archetype, FieldKind, TemplateDetail, TemplateSummary } from './domain/model';
export { canManageTemplates, canReadTemplates } from './domain/permissions';

export type TemplatesConfig = {
  /** app_runtime client; every query is scoped through withTenant. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createTemplatesModule(cfg: TemplatesConfig) {
  const service = new TemplatesService(new PrismaTemplateRepository(cfg.db));
  return {
    basePath: '/api/v1/templates',
    router: templatesRouter(service, cfg.identity.guards),
    service,
  };
}

export type TemplatesModule = ReturnType<typeof createTemplatesModule>;
