// Public surface of the templates module. Other modules import ONLY from here.
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { TemplatesService } from './application/templates.service';
import { templatesRouter } from './http/templates.routes';
import { PrismaTemplateRepository } from './infrastructure/prisma-template.repository';

export type {
  AllowedField,
  Archetype,
  CampaignTemplate,
  FieldGroup,
  FieldKind,
} from './domain/model';
export { ARCHETYPES, FIELD_KINDS, groupOf } from './domain/model';

export type TemplatesConfig = {
  /** app_runtime client; the template tables are global and read-only for it. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards'>;
};

export function createTemplatesModule(cfg: TemplatesConfig) {
  const service = new TemplatesService(new PrismaTemplateRepository(cfg.db));
  return {
    basePath: '/api/v1/templates',
    router: templatesRouter(service, cfg.identity.guards),
    service,
    /** For the campaigns module: the built-in types a campaign may use, with what they allow. */
    lookup: {
      many: (_ctx: unknown, ids: readonly string[]) => service.many(ids),
    },
  };
}

export type TemplatesModule = ReturnType<typeof createTemplatesModule>;
