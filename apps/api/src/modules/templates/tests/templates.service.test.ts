import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TemplatesService } from '../application/templates.service';
import type { Actor } from '../domain/model';
import { InMemoryTemplateRepository } from './fakes';
import { field } from './repository.contract';

const tenantId = randomUUID();
const owner: Actor = { userId: randomUUID(), tenantId, role: 'BUSINESS_OWNER' };
const analyst: Actor = { ...owner, role: 'ANALYST' };
const consent = field({ kind: 'consent', key: 'consent', label: 'I agree' });
const publishable = [field(), consent];

let service: TemplatesService;
beforeEach(() => {
  service = new TemplatesService(new InMemoryTemplateRepository());
});

const draft = async (fields = publishable) => {
  const t = await service.create(owner, { name: 'Entry', archetype: 'giveaway' });
  return service.update(owner, t.id, {
    expectedVersion: t.version,
    name: 'Entry',
    archetype: 'giveaway',
    fields,
  });
};

describe('access', () => {
  it('needs an active business', async () => {
    await expect(service.list(null, {})).rejects.toMatchObject({
      status: 403,
      code: 'NO_ACTIVE_BUSINESS',
    });
  });

  it('lets read-only roles read but not change', async () => {
    const t = await draft();
    expect(await service.list(analyst, {})).toHaveLength(1);
    expect(await service.get(analyst, t.id)).toMatchObject({ id: t.id });
    for (const attempt of [
      () => service.create(analyst, { name: 'x', archetype: 'quiz' }),
      () =>
        service.update(analyst, t.id, {
          expectedVersion: 2,
          name: 'x',
          archetype: 'quiz',
          fields: [],
        }),
      () => service.publish(analyst, t.id, 2),
      () => service.unpublish(analyst, t.id, 2),
      () => service.duplicate(analyst, t.id),
      () => service.remove(analyst, t.id),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    }
  });

  it('never reaches another business', async () => {
    const t = await draft();
    const stranger: Actor = { ...owner, tenantId: randomUUID() };
    await expect(service.get(stranger, t.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.list(stranger, {})).toEqual([]);
  });
});

describe('saving a draft', () => {
  it('normalises input and bumps the version', async () => {
    const t = await draft([field({ key: ' email ', label: ' Email ' }), consent]);
    expect(t.version).toBe(2);
    expect(t.fields[0]).toMatchObject({ key: 'email', label: 'Email' });
  });

  it('rejects repeated field names with the names listed', async () => {
    const t = await service.create(owner, { name: 'x', archetype: 'quiz' });
    await expect(
      service.update(owner, t.id, {
        expectedVersion: 1,
        name: 'x',
        archetype: 'quiz',
        fields: [field(), field()],
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'TEMPLATE_INVALID',
      details: { duplicateKeys: ['email'] },
    });
  });

  it('answers 412 for a stale version', async () => {
    const t = await draft();
    await expect(
      service.update(owner, t.id, { expectedVersion: 1, name: 'x', archetype: 'quiz', fields: [] }),
    ).rejects.toMatchObject({ status: 412, code: 'VERSION_CONFLICT' });
  });
});

describe('publishing', () => {
  it('publishes a template that passes every check', async () => {
    const t = await draft();
    const out = await service.publish(owner, t.id, t.version);
    expect(out).toMatchObject({ status: 'PUBLISHED', version: t.version + 1 });
  });

  it('refuses with the failed checks named, and changes nothing', async () => {
    const t = await draft([field({ kind: 'full_name', key: 'n', label: 'Name' })]);
    await expect(service.publish(owner, t.id, t.version)).rejects.toMatchObject({
      status: 422,
      code: 'PREFLIGHT_FAILED',
      details: { failed: ['identity', 'consent'] },
    });
    expect(await service.get(owner, t.id)).toMatchObject({ status: 'DRAFT', version: t.version });
  });

  it('refuses a stale version, and publishing twice', async () => {
    const t = await draft();
    await expect(service.publish(owner, t.id, 1)).rejects.toMatchObject({ status: 412 });
    const live = await service.publish(owner, t.id, t.version);
    await expect(service.publish(owner, t.id, live.version)).rejects.toMatchObject({
      status: 409,
      code: 'TEMPLATE_STATE',
    });
  });

  it('locks a published template until it is unpublished', async () => {
    const t = await draft();
    const live = await service.publish(owner, t.id, t.version);
    await expect(
      service.update(owner, t.id, {
        expectedVersion: live.version,
        name: 'x',
        archetype: 'quiz',
        fields: [],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'TEMPLATE_PUBLISHED' });
    await expect(service.remove(owner, t.id)).rejects.toMatchObject({
      status: 409,
      code: 'TEMPLATE_PUBLISHED',
    });

    const back = await service.unpublish(owner, t.id, live.version);
    expect(back.status).toBe('DRAFT');
    await service.remove(owner, t.id);
    await expect(service.get(owner, t.id)).rejects.toMatchObject({ status: 404 });
  });

  it('reports unpublishing a draft as a state error', async () => {
    const t = await draft();
    await expect(service.unpublish(owner, t.id, t.version)).rejects.toMatchObject({
      status: 409,
      code: 'TEMPLATE_STATE',
    });
  });
});

describe('duplicating and deleting', () => {
  it('copies as a draft named as a copy', async () => {
    const t = await draft();
    const live = await service.publish(owner, t.id, t.version);
    const copy = await service.duplicate(owner, t.id);
    expect(copy).toMatchObject({ name: 'Entry (copy)', status: 'DRAFT', version: 1 });
    expect(copy.fields).toHaveLength(2);
    expect(live.status).toBe('PUBLISHED');
  });

  it('keeps a long copy name within the limit', async () => {
    const t = await service.create(owner, { name: 'x'.repeat(120), archetype: 'quiz' });
    expect((await service.duplicate(owner, t.id)).name).toHaveLength(120);
  });

  it('answers 404 for a template that does not exist', async () => {
    await expect(service.duplicate(owner, randomUUID())).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(owner, randomUUID())).rejects.toMatchObject({ status: 404 });
  });
});
