import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTenantContext, type TenantContext } from '@/shared/database';
import type { TemplateRepository } from '../application/ports';
import type { FieldInput } from '../domain/model';

export const field = (over: Partial<FieldInput> = {}): FieldInput => ({
  kind: 'email',
  key: 'email',
  label: 'Email address',
  helper: '',
  required: true,
  options: [],
  ...over,
});

export type ContractWorld = {
  repo: TemplateRepository;
  /** Two businesses that exist (the database needs real tenants); users who work in them. */
  tenantA: string;
  tenantB: string;
  userA: string;
};

/**
 * What every TemplateRepository must do, whatever it stores into. It runs against the in-memory
 * fake and against real PostgreSQL with the real roles, so the two cannot drift apart.
 */
export function repositoryContract(
  label: string,
  world: () => Promise<ContractWorld> | ContractWorld,
) {
  describe(`${label}: template repository contract`, () => {
    let w: ContractWorld;
    let a: TenantContext;
    let b: TenantContext;
    beforeAll(async () => {
      w = await world();
      a = createTenantContext({ tenantId: w.tenantA, actorId: w.userA, requestId: randomUUID() });
      b = createTenantContext({ tenantId: w.tenantB, requestId: randomUUID() });
    });

    const make = (name = `T-${randomUUID().slice(0, 6)}`) =>
      w.repo.create(a, { name, archetype: 'giveaway', createdById: w.userA });

    it('creates an empty draft at version 1', async () => {
      const t = await make('First');
      expect(t).toMatchObject({
        name: 'First',
        archetype: 'giveaway',
        status: 'DRAFT',
        version: 1,
        fields: [],
      });
      expect(await w.repo.get(a, t.id)).toMatchObject({ id: t.id });
    });

    it('replaces the fields in order and bumps the version', async () => {
      const t = await make();
      const out = await w.repo.saveDraft(a, t.id, 1, {
        name: 'Renamed',
        archetype: 'quiz',
        fields: [
          field(),
          field({ kind: 'choice', key: 'question', label: 'Pick', options: ['A', 'B'] }),
          field({ kind: 'consent', key: 'consent', label: 'I agree' }),
        ],
      });
      expect(out.kind).toBe('ok');
      if (out.kind !== 'ok') return;
      expect(out.template).toMatchObject({ name: 'Renamed', archetype: 'quiz', version: 2 });
      expect(out.template.fields.map((f) => f.key)).toEqual(['email', 'question', 'consent']);
      expect(out.template.fields[1]!.options).toEqual(['A', 'B']);

      const again = await w.repo.saveDraft(a, t.id, 2, {
        name: 'Renamed',
        archetype: 'quiz',
        fields: [field({ kind: 'consent', key: 'consent', label: 'I agree' }), field()],
      });
      expect(again.kind === 'ok' && again.template.fields.map((f) => f.key)).toEqual([
        'consent',
        'email',
      ]);
    });

    it('refuses a stale version and writes nothing', async () => {
      const t = await make('Stale');
      await w.repo.saveDraft(a, t.id, 1, {
        name: 'Stale',
        archetype: 'giveaway',
        fields: [field()],
      });
      const stale = await w.repo.saveDraft(a, t.id, 1, {
        name: 'Overwrite',
        archetype: 'giveaway',
        fields: [],
      });
      expect(stale.kind).toBe('conflict');
      const now = await w.repo.get(a, t.id);
      expect(now).toMatchObject({ name: 'Stale', version: 2 });
      expect(now?.fields).toHaveLength(1);
    });

    it('publishes, then reports the same state, and locks edits and deletion', async () => {
      const t = await make();
      const pub = await w.repo.setStatus(a, t.id, 1, 'PUBLISHED');
      expect(pub.kind === 'ok' && pub.template).toMatchObject({ status: 'PUBLISHED', version: 2 });
      expect(pub.kind === 'ok' && pub.template.publishedAt).toBeTruthy();
      expect((await w.repo.setStatus(a, t.id, 2, 'PUBLISHED')).kind).toBe('same_state');
      expect(
        (await w.repo.saveDraft(a, t.id, 2, { name: 'x', archetype: 'giveaway', fields: [] })).kind,
      ).toBe('locked');
      expect(await w.repo.softDelete(a, t.id)).toBe('locked');
    });

    it('refuses to publish at a stale version, and unpublishes back to a draft', async () => {
      const t = await make();
      expect((await w.repo.setStatus(a, t.id, 99, 'PUBLISHED')).kind).toBe('conflict');
      await w.repo.setStatus(a, t.id, 1, 'PUBLISHED');
      const back = await w.repo.setStatus(a, t.id, 2, 'DRAFT');
      expect(back.kind === 'ok' && back.template).toMatchObject({
        status: 'DRAFT',
        version: 3,
        publishedAt: null,
      });
    });

    it('duplicates as a new draft with its own ids and leaves the source alone', async () => {
      const t = await make('Original');
      await w.repo.saveDraft(a, t.id, 1, {
        name: 'Original',
        archetype: 'survey',
        fields: [field(), field({ kind: 'text', key: 'answer', label: 'Say more' })],
      });
      await w.repo.setStatus(a, t.id, 2, 'PUBLISHED');
      const copy = await w.repo.duplicate(a, t.id, {
        name: 'Original (copy)',
        createdById: w.userA,
      });
      expect(copy).toMatchObject({
        name: 'Original (copy)',
        status: 'DRAFT',
        version: 1,
        archetype: 'survey',
      });
      expect(copy?.id).not.toBe(t.id);
      expect(copy?.fields.map((f) => f.key)).toEqual(['email', 'answer']);
      const source = await w.repo.get(a, t.id);
      expect(source).toMatchObject({ status: 'PUBLISHED' });
      expect(source?.fields.map((f) => f.id)).not.toEqual(copy?.fields.map((f) => f.id));
    });

    it('soft-deletes a draft so it disappears from reads and lists', async () => {
      const t = await make('Gone');
      expect(await w.repo.softDelete(a, t.id)).toBe('ok');
      expect(await w.repo.get(a, t.id)).toBeNull();
      expect((await w.repo.list(a, {})).some((x) => x.id === t.id)).toBe(false);
      expect(await w.repo.softDelete(a, t.id)).toBe('not_found');
    });

    it('lists newest first with a field count, filtered by status and name', async () => {
      const tag = randomUUID().slice(0, 8);
      const draft = await make(`Find-${tag}-draft`);
      const published = await make(`Find-${tag}-live`);
      await w.repo.saveDraft(a, published.id, 1, {
        name: `Find-${tag}-live`,
        archetype: 'giveaway',
        fields: [field()],
      });
      await w.repo.setStatus(a, published.id, 2, 'PUBLISHED');

      const byName = await w.repo.list(a, { q: tag.toUpperCase() });
      expect(byName.map((x) => x.id).sort()).toEqual([draft.id, published.id].sort());
      expect(byName.find((x) => x.id === published.id)).toMatchObject({
        fieldCount: 1,
        status: 'PUBLISHED',
      });
      expect((await w.repo.list(a, { q: tag, status: 'DRAFT' })).map((x) => x.id)).toEqual([
        draft.id,
      ]);
    });

    it('returns summaries only for templates that exist in this business', async () => {
      const one = await make('Lookup one');
      const two = await make('Lookup two');
      const gone = await make('Lookup gone');
      await w.repo.softDelete(a, gone.id);
      const found = await w.repo.summaries(a, [one.id, two.id, gone.id, randomUUID()]);
      expect(found.map((t) => t.id).sort()).toEqual([one.id, two.id].sort());
      expect(await w.repo.summaries(b, [one.id, two.id])).toEqual([]);
      expect(await w.repo.summaries(a, [])).toEqual([]);
    });

    it("keeps one business out of another's templates", async () => {
      const t = await make('Private');
      expect(await w.repo.get(b, t.id)).toBeNull();
      expect((await w.repo.list(b, {})).some((x) => x.id === t.id)).toBe(false);
      expect(
        (await w.repo.saveDraft(b, t.id, 1, { name: 'Hijack', archetype: 'giveaway', fields: [] }))
          .kind,
      ).toBe('not_found');
      expect((await w.repo.setStatus(b, t.id, 1, 'PUBLISHED')).kind).toBe('not_found');
      expect(await w.repo.duplicate(b, t.id, { name: 'x', createdById: w.userA })).toBeNull();
      expect(await w.repo.softDelete(b, t.id)).toBe('not_found');
      expect(await w.repo.get(a, t.id)).toMatchObject({ name: 'Private', version: 1 });
    });
  });
}
