// Public surface of the administration module (platform staff). Other modules import ONLY from here.
// This is the one module allowed to use the platform database role (BYPASSRLS).
import type { PrismaClient } from '@/generated/prisma/client';
import type { IdentityModule } from '@/modules/identity';
import { AdministrationService } from './application/administration.service';
import { administrationRouter } from './http/administration.routes';
import { PrismaAdministrationRepository } from './infrastructure/prisma-administration.repository';

export type {
  CrossBusiness,
  Decision,
  ReportItem,
  ReportPage,
  ReviewItem,
  ReviewPage,
} from './domain/model';

export type AdministrationConfig = {
  /** app_platform client (BYPASSRLS). Never pass the runtime client here, and never use this one elsewhere. */
  db: PrismaClient;
  identity: Pick<IdentityModule, 'guards' | 'auth'>;
};

export function createAdministrationModule(cfg: AdministrationConfig) {
  const service = new AdministrationService(
    new PrismaAdministrationRepository(cfg.db),
    (who, password) => cfg.identity.auth.confirmPassword(who, password),
  );
  return {
    basePath: '/api/v1/platform',
    router: administrationRouter(service, cfg.identity.guards),
    service,
  };
}

export type AdministrationModule = ReturnType<typeof createAdministrationModule>;
