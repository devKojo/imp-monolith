import { randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import {
  CampaignNotFoundError,
  NoActiveBusinessError,
  ParticipantsPermissionError,
} from '../domain/errors';
import type {
  Actor,
  CampaignActivity,
  ListQuery,
  ParticipantSummary,
  ParticipationPage,
} from '../domain/model';
import { canViewParticipants } from '../domain/permissions';
import type { ParticipantsRepository } from './ports';

/**
 * What a business sees about its participants. Each method resolves the business from the actor (never
 * from input) and checks the role once, so no route can forget it (R-ARC-08).
 */
export class ParticipantsService {
  constructor(
    private readonly repo: ParticipantsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private scope(actor: Actor | null): TenantContext {
    if (!actor) throw new NoActiveBusinessError();
    if (!canViewParticipants(actor.role)) throw new ParticipantsPermissionError();
    return createTenantContext({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      requestId: randomUUID(),
    });
  }

  async summary(actor: Actor | null): Promise<ParticipantSummary> {
    return this.repo.summary(this.scope(actor));
  }

  async list(actor: Actor | null, query: ListQuery): Promise<ParticipationPage> {
    return this.repo.list(this.scope(actor), query);
  }

  async campaign(actor: Actor | null, campaignId: string): Promise<CampaignActivity> {
    const found = await this.repo.campaign(this.scope(actor), campaignId, this.now());
    if (!found) throw new CampaignNotFoundError();
    return found;
  }
}
