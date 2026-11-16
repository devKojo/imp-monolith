import { describe, expect, it } from 'vitest';
import type { ParticipantsRepository } from '../application/ports';
import { ParticipantsService } from '../application/participants.service';
import { canViewParticipants } from '../domain/permissions';

const empty = { participants: 0, started: 0, completed: 0, campaigns: [] };
const seen: string[] = [];
const repo: ParticipantsRepository = {
  summary: async (ctx) => {
    seen.push(ctx.tenantId);
    return empty;
  },
  campaign: async (ctx, id) => {
    seen.push(ctx.tenantId);
    return id === 'known'
      ? {
          campaignId: id,
          title: 'T',
          kind: 'quiz',
          started: 0,
          completed: 0,
          daily: [],
          quiz: null,
        }
      : null;
  },
  list: async (ctx) => {
    seen.push(ctx.tenantId);
    return { items: [], total: 0 };
  },
};
const service = new ParticipantsService(repo);
const actor = (role: string) => ({
  userId: '01a1e000-0000-7000-8000-0000000000a1',
  tenantId: '01a1e000-0000-7000-8000-0000000000b1',
  role,
});
const query = { limit: 50, offset: 0 };

describe('who may see participants', () => {
  it('is the people who run the business and its analysts', () => {
    for (const role of [
      'BUSINESS_OWNER',
      'BUSINESS_ADMINISTRATOR',
      'CAMPAIGN_MANAGER',
      'ANALYST',
    ]) {
      expect(canViewParticipants(role)).toBe(true);
    }
    for (const role of ['CAMPAIGN_OPERATOR', 'MODERATOR', 'PARTICIPANT', '']) {
      expect(canViewParticipants(role)).toBe(false);
    }
  });
});

describe('ParticipantsService', () => {
  it('works in the business of the actor, never one from the request', async () => {
    seen.length = 0;
    await service.summary(actor('BUSINESS_OWNER'));
    await service.list(actor('ANALYST'), query);
    expect(seen).toEqual([actor('x').tenantId, actor('x').tenantId]);
  });

  it('refuses a role that may not see participants, before touching storage', async () => {
    seen.length = 0;
    await expect(service.summary(actor('MODERATOR'))).rejects.toMatchObject({ status: 403 });
    await expect(service.list(actor('CAMPAIGN_OPERATOR'), query)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(seen).toEqual([]);
  });

  it('refuses an account with no active business', async () => {
    await expect(service.summary(null)).rejects.toMatchObject({
      status: 403,
      code: 'NO_ACTIVE_BUSINESS',
    });
  });

  it('finds a campaign of the business, and says not found otherwise', async () => {
    await expect(service.campaign(actor('ANALYST'), 'known')).resolves.toMatchObject({
      campaignId: 'known',
    });
    await expect(service.campaign(actor('ANALYST'), 'other')).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.campaign(actor('MODERATOR'), 'known')).rejects.toMatchObject({
      status: 403,
    });
  });
});
