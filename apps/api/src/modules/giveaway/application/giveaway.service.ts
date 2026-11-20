import { randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import { GiveawayNotFoundError, ParticipantOnlyError } from '../domain/errors';
import type {
  EntryRow,
  GiveawayInfo,
  GiveawayView,
  Participant,
  RunnableGiveaway,
} from '../domain/model';
import type { GiveawayRepository } from './ports';

/**
 * Giveaway workflows: a participant enters once and holds a ticket. The business is found from the
 * campaign's public address, never from the request.
 */
export class GiveawayService {
  constructor(
    private readonly repo: GiveawayRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async locate(slug: string): Promise<RunnableGiveaway> {
    const found = await this.repo.locate(slug, this.now());
    if (!found) throw new GiveawayNotFoundError();
    return found;
  }

  private scopeOf(found: RunnableGiveaway, actorId?: string): TenantContext {
    return createTenantContext({
      tenantId: found.tenantId,
      ...(actorId ? { actorId } : {}),
      requestId: randomUUID(),
    });
  }

  private async enter(participant: Participant | null, slug: string) {
    if (participant?.accountType !== 'PARTICIPANT') throw new ParticipantOnlyError();
    const found = await this.locate(slug);
    return { found, ctx: this.scopeOf(found, participant.userId), userId: participant.userId };
  }

  private info(slug: string, found: RunnableGiveaway, entryCount: number): GiveawayInfo {
    return {
      slug,
      title: found.title,
      businessName: found.businessName,
      endsAt: found.endAt.toISOString(),
      entryCount,
    };
  }

  private view(
    slug: string,
    found: RunnableGiveaway,
    entryCount: number,
    entry: EntryRow | null,
  ): GiveawayView {
    return {
      ...this.info(slug, found, entryCount),
      summary: found.summary,
      entry: entry
        ? { ticketNumber: entry.ticketNumber, enteredAt: entry.enteredAt.toISOString() }
        : null,
    };
  }

  /** Public facts about a running giveaway: enough to decide whether to enter. */
  async publicInfo(slug: string): Promise<GiveawayInfo> {
    const found = await this.locate(slug);
    return this.info(slug, found, await this.repo.count(this.scopeOf(found), found.campaignId));
  }

  /** The participant's own standing: their ticket if they have entered. */
  async current(participant: Participant | null, slug: string): Promise<GiveawayView> {
    const { found, ctx, userId } = await this.enter(participant, slug);
    const [entry, count] = await Promise.all([
      this.repo.entry(ctx, found.campaignId, userId),
      this.repo.count(ctx, found.campaignId),
    ]);
    return this.view(slug, found, count, entry);
  }

  /** Enters the participant. Safe to repeat: they keep the ticket they already have. */
  async join(participant: Participant | null, slug: string): Promise<GiveawayView> {
    const { found, ctx, userId } = await this.enter(participant, slug);
    const entry =
      (await this.repo.entry(ctx, found.campaignId, userId)) ??
      (await this.repo.enter(ctx, { campaignId: found.campaignId, userId, at: this.now() }));
    return this.view(slug, found, await this.repo.count(ctx, found.campaignId), entry);
  }
}
