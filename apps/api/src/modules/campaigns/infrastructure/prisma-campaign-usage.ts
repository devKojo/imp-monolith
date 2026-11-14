import type { PrismaClient } from '@/generated/prisma/client';
import { withTenant, type TenantContext } from '@/shared/database';

/**
 * Whether a template is relied on by a campaign that is still running (scheduled, live or paused
 * and not yet past its end). Handed to the templates module at the composition root so it can refuse
 * to unpublish or delete such a template without reading this module's tables.
 */
export class PrismaCampaignUsage {
  constructor(private readonly db: PrismaClient) {}

  isInUse(ctx: TenantContext, templateId: string): Promise<boolean> {
    return withTenant(this.db, ctx, async (tx) => {
      const count = await tx.campaign.count({
        where: {
          tenantId: ctx.tenantId,
          templateId,
          deletedAt: null,
          status: { in: ['SCHEDULED', 'LIVE', 'PAUSED'] },
          endAt: { gt: new Date() },
        },
      });
      return count > 0;
    });
  }
}
