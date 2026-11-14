import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTenantContext, type TenantContext } from '@/shared/database';
import { ConflictError } from '@/shared/errors';
import type { CampaignRepository, DraftContent } from '../application/ports';

export const content = (over: Partial<DraftContent> = {}): DraftContent => ({
  title: 'Launch giveaway',
  summary: 'Win something nice.',
  templateId: null,
  startAt: null,
  endAt: new Date(Date.now() + 7 * 86_400_000),
  prizes: [{ name: 'Grand prize', valueLabel: '1,000', winners: 1, description: 'The big one' }],
  ...over,
});

export type ContractWorld = {
  repo: CampaignRepository;
  tenantA: string;
  tenantB: string;
  userA: string;
  /** A template that exists in business A (the database needs a real one for the foreign key). */
  templateA: string;
};

/**
 * What every CampaignRepository must do, whatever it stores into. It runs against the in-memory fake
 * and against real PostgreSQL with the real roles, so the two cannot drift apart.
 */
export function repositoryContract(
  label: string,
  world: () => Promise<ContractWorld> | ContractWorld,
) {
  describe(`${label}: campaign repository contract`, () => {
    let w: ContractWorld;
    let a: TenantContext;
    let b: TenantContext;
    beforeAll(async () => {
      w = await world();
      a = createTenantContext({ tenantId: w.tenantA, actorId: w.userA, requestId: randomUUID() });
      b = createTenantContext({ tenantId: w.tenantB, requestId: randomUUID() });
    });

    const make = (title = `C-${randomUUID().slice(0, 6)}`) =>
      w.repo.create(a, { title, templateId: null, createdById: w.userA });
    const slug = () => `launch-${randomUUID().slice(0, 8)}`;

    it('creates an empty draft at version 1, with or without a template', async () => {
      const bare = await make('First');
      expect(bare).toMatchObject({
        title: 'First',
        status: 'DRAFT',
        version: 1,
        slug: null,
        prizes: [],
      });
      const withTemplate = await w.repo.create(a, {
        title: 'T',
        templateId: w.templateA,
        createdById: w.userA,
      });
      expect(withTemplate.templateId).toBe(w.templateA);
    });

    it('replaces the content and the prizes in order, and bumps the version', async () => {
      const c = await make();
      const out = await w.repo.saveDraft(
        a,
        c.id,
        1,
        content({
          title: 'Renamed',
          templateId: w.templateA,
          startAt: new Date(Date.now() + 86_400_000),
          prizes: [
            { name: 'One', valueLabel: '', winners: 1, description: '' },
            { name: 'Two', valueLabel: '50', winners: 3, description: 'Runners up' },
          ],
        }),
      );
      expect(out.kind).toBe('ok');
      if (out.kind !== 'ok') return;
      expect(out.campaign).toMatchObject({ title: 'Renamed', version: 2, templateId: w.templateA });
      expect(out.campaign.prizes.map((p) => [p.name, p.winners])).toEqual([
        ['One', 1],
        ['Two', 3],
      ]);
      expect(out.campaign.startAt).toBeTruthy();

      const again = await w.repo.saveDraft(
        a,
        c.id,
        2,
        content({ prizes: [{ name: 'Only', valueLabel: '', winners: 2, description: '' }] }),
      );
      expect(again.kind === 'ok' && again.campaign.prizes.map((p) => p.name)).toEqual(['Only']);
    });

    it('refuses a stale version and writes nothing', async () => {
      const c = await make('Stale');
      await w.repo.saveDraft(a, c.id, 1, content({ title: 'Stale' }));
      const stale = await w.repo.saveDraft(a, c.id, 1, content({ title: 'Overwrite', prizes: [] }));
      expect(stale.kind).toBe('conflict');
      const now = await w.repo.get(a, c.id);
      expect(now).toMatchObject({ title: 'Stale', version: 2 });
      expect(now?.prizes).toHaveLength(1);
    });

    it('launches a draft, fixes its address, and then refuses edits', async () => {
      const c = await make();
      await w.repo.saveDraft(a, c.id, 1, content());
      const address = slug();
      const launched = await w.repo.launch(a, c.id, 2, { status: 'LIVE', slug: address });
      expect(launched.kind === 'ok' && launched.campaign).toMatchObject({
        status: 'LIVE',
        slug: address,
        version: 3,
      });
      expect(launched.kind === 'ok' && launched.campaign.launchedAt).toBeTruthy();
      expect((await w.repo.saveDraft(a, c.id, 3, content())).kind).toBe('wrong_state');
      expect((await w.repo.launch(a, c.id, 3, { status: 'LIVE', slug: slug() })).kind).toBe(
        'wrong_state',
      );
      expect(await w.repo.softDelete(a, c.id)).toBe('locked');
    });

    it('refuses to launch at a stale version', async () => {
      const c = await make();
      await w.repo.saveDraft(a, c.id, 1, content());
      expect((await w.repo.launch(a, c.id, 1, { status: 'LIVE', slug: slug() })).kind).toBe(
        'conflict',
      );
    });

    it('keeps page addresses unique across businesses', async () => {
      const first = await make();
      const second = await make();
      await w.repo.saveDraft(a, first.id, 1, content());
      await w.repo.saveDraft(a, second.id, 1, content());
      const shared = slug();
      await w.repo.launch(a, first.id, 2, { status: 'LIVE', slug: shared });
      await expect(
        w.repo.launch(a, second.id, 2, { status: 'LIVE', slug: shared }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect((await w.repo.get(a, second.id))?.status).toBe('DRAFT');
    });

    it('moves between states only from the states allowed, at the right version', async () => {
      const c = await make();
      await w.repo.saveDraft(a, c.id, 1, content());
      await w.repo.launch(a, c.id, 2, { status: 'LIVE', slug: slug() });

      expect((await w.repo.transition(a, c.id, 99, { from: ['LIVE'], to: 'PAUSED' })).kind).toBe(
        'conflict',
      );
      const paused = await w.repo.transition(a, c.id, 3, {
        from: ['SCHEDULED', 'LIVE'],
        to: 'PAUSED',
      });
      expect(paused.kind === 'ok' && paused.campaign).toMatchObject({
        status: 'PAUSED',
        version: 4,
      });
      expect((await w.repo.transition(a, c.id, 4, { from: ['LIVE'], to: 'PAUSED' })).kind).toBe(
        'wrong_state',
      );
      const resumed = await w.repo.transition(a, c.id, 4, { from: ['PAUSED'], to: 'LIVE' });
      expect(resumed.kind === 'ok' && resumed.campaign.status).toBe('LIVE');
      const cancelled = await w.repo.transition(a, c.id, 5, {
        from: ['SCHEDULED', 'LIVE', 'PAUSED'],
        to: 'CANCELLED',
      });
      expect(cancelled.kind === 'ok' && cancelled.campaign.status).toBe('CANCELLED');
    });

    it('duplicates as a draft with its own ids, without schedule or address', async () => {
      const c = await make('Original');
      await w.repo.saveDraft(
        a,
        c.id,
        1,
        content({
          title: 'Original',
          templateId: w.templateA,
          startAt: new Date(Date.now() + 86_400_000),
        }),
      );
      await w.repo.launch(a, c.id, 2, { status: 'SCHEDULED', slug: slug() });
      const copy = await w.repo.duplicate(a, c.id, {
        title: 'Original (copy)',
        createdById: w.userA,
      });
      expect(copy).toMatchObject({
        title: 'Original (copy)',
        status: 'DRAFT',
        version: 1,
        slug: null,
        startAt: null,
        endAt: null,
        templateId: w.templateA,
      });
      expect(copy?.prizes.map((p) => p.name)).toEqual(['Grand prize']);
      const source = await w.repo.get(a, c.id);
      expect(source?.status).toBe('SCHEDULED');
      expect(source?.prizes[0]?.id).not.toBe(copy?.prizes[0]?.id);
    });

    it('soft-deletes a draft so it disappears from reads and lists', async () => {
      const c = await make('Gone');
      expect(await w.repo.softDelete(a, c.id)).toBe('ok');
      expect(await w.repo.get(a, c.id)).toBeNull();
      expect((await w.repo.list(a)).some((x) => x.id === c.id)).toBe(false);
      expect(await w.repo.softDelete(a, c.id)).toBe('not_found');
    });

    it('lists newest first with a prize count', async () => {
      const c = await make(`List-${randomUUID().slice(0, 6)}`);
      await w.repo.saveDraft(a, c.id, 1, content({ title: c.title }));
      const row = (await w.repo.list(a)).find((x) => x.id === c.id);
      expect(row).toMatchObject({ prizeCount: 1, status: 'DRAFT', version: 2 });
    });

    it("keeps one business out of another's campaigns", async () => {
      const c = await make('Private');
      expect(await w.repo.get(b, c.id)).toBeNull();
      expect((await w.repo.list(b)).some((x) => x.id === c.id)).toBe(false);
      expect((await w.repo.saveDraft(b, c.id, 1, content())).kind).toBe('not_found');
      expect((await w.repo.launch(b, c.id, 1, { status: 'LIVE', slug: slug() })).kind).toBe(
        'not_found',
      );
      expect((await w.repo.transition(b, c.id, 1, { from: ['DRAFT'], to: 'CANCELLED' })).kind).toBe(
        'not_found',
      );
      expect(await w.repo.duplicate(b, c.id, { title: 'x', createdById: w.userA })).toBeNull();
      expect(await w.repo.softDelete(b, c.id)).toBe('not_found');
      expect(await w.repo.get(a, c.id)).toMatchObject({ title: 'Private', version: 1 });
    });
  });
}
