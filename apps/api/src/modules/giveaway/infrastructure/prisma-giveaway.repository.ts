import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { claimSeat } from '@/modules/campaigns';
import { recordSignal, withPublic, withTenant, type TenantContext } from '@/shared/database';
import type { GiveawayRepository } from '../application/ports';
import type { EntryRow, RunnableGiveaway } from '../domain/model';

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * Giveaway entries in PostgreSQL. Every call is one `withTenant` transaction (row-level security applies)
 * except `locate`, which reads the same running campaigns the public listing shows through `withPublic`.
 */
export class PrismaGiveawayRepository implements GiveawayRepository {
  constructor(private readonly db: PrismaClient) {}

  locate(slug: string, now: Date): Promise<RunnableGiveaway | null> {
    return withPublic(this.db, async (tx) => {
      const row = await tx.campaign.findFirst({
        where: {
          slug,
          deletedAt: null,
          endAt: { gt: now },
          // COMPLETED here (with the end date still ahead) means a prize pool campaign that is full: people
          // already in can still see their ticket; a new person is refused when they try to take a seat.
          OR: [
            { status: 'LIVE' },
            { status: 'SCHEDULED', startAt: { lte: now } },
            { status: 'COMPLETED' },
          ],
          business: { status: { in: ['PENDING', 'ACTIVE'] } },
          template: { archetype: 'GIVEAWAY' },
        },
        select: {
          id: true,
          tenantId: true,
          title: true,
          summary: true,
          endAt: true,
          business: { select: { name: true } },
        },
      });
      return row && row.endAt
        ? {
            campaignId: row.id,
            tenantId: row.tenantId,
            title: row.title,
            summary: row.summary,
            businessName: row.business.name,
            endAt: row.endAt,
          }
        : null;
    });
  }

  entry(ctx: TenantContext, campaignId: string, userId: string): Promise<EntryRow | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.giveawayEntry.findFirst({
        where: { tenantId: ctx.tenantId, campaignId, userId },
        select: { ticketNumber: true, enteredAt: true },
      });
      return row ?? null;
    });
  }

  count(ctx: TenantContext, campaignId: string): Promise<number> {
    return withTenant(this.db, ctx, (tx) =>
      tx.giveawayEntry.count({ where: { tenantId: ctx.tenantId, campaignId } }),
    );
  }

  async enter(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; at: Date },
  ): Promise<EntryRow> {
    try {
      return await withTenant(this.db, ctx, async (tx) => {
        // Entering takes a seat on the campaign (a prize pool campaign has a limited number). The seat
        // update holds the campaign row until this transaction ends, so the count it leaves is this
        // entry's own number and no two entries share one.
        await claimSeat(tx, ctx.tenantId, input.campaignId);
        await recordSignal(tx, {
          tenantId: ctx.tenantId,
          campaignId: input.campaignId,
          userId: input.userId,
          kind: 'JOIN',
        });
        const campaign = await tx.campaign.findFirstOrThrow({
          where: { id: input.campaignId, tenantId: ctx.tenantId },
          select: { participantCount: true },
        });
        return tx.giveawayEntry.create({
          data: {
            tenantId: ctx.tenantId,
            campaignId: input.campaignId,
            userId: input.userId,
            ticketNumber: campaign.participantCount,
            enteredAt: input.at,
          },
          select: { ticketNumber: true, enteredAt: true },
        });
      });
    } catch (e) {
      // A double click or a second tab got there first: return that entry (the seat was rolled back).
      if (!isUniqueViolation(e)) throw e;
      const existing = await this.entry(ctx, input.campaignId, input.userId);
      if (existing) return existing;
      throw e;
    }
  }
}
