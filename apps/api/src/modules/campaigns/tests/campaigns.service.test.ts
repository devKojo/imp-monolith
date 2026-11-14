import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CampaignsService } from '../application/campaigns.service';
import type { Actor, TemplateRef } from '../domain/model';
import { FakeTemplateLookup, InMemoryCampaignRepository } from './fakes';

const NOW = new Date('2026-11-14T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString();
const tenantId = randomUUID();
const owner: Actor = { userId: randomUUID(), tenantId, role: 'BUSINESS_OWNER' };
const operator: Actor = { ...owner, role: 'CAMPAIGN_OPERATOR' };
const analyst: Actor = { ...owner, role: 'ANALYST' };
const prize = { name: 'Grand prize', valueLabel: '1,000', winners: 1, description: '' };

let templates: FakeTemplateLookup;
let repo: InMemoryCampaignRepository;
let service: CampaignsService;
let now = NOW;
let n = 0;
const published: TemplateRef = {
  id: randomUUID(),
  name: 'Entry',
  archetype: 'giveaway',
  status: 'PUBLISHED',
};

beforeEach(() => {
  now = NOW;
  n = 0;
  templates = new FakeTemplateLookup();
  templates.add(published);
  repo = new InMemoryCampaignRepository();
  service = new CampaignsService(
    repo,
    templates,
    () => now,
    () => `s${(n += 1)}`,
  );
});

const body = (over: Record<string, unknown> = {}) => ({
  title: 'Black Friday',
  summary: ' Win big ',
  templateId: published.id as string | null,
  startAt: null as string | null,
  endAt: hours(48) as string | null,
  prizes: [prize],
  ...over,
});
const draft = async (over: Record<string, unknown> = {}) => {
  const c = await service.create(owner, { title: 'Black Friday' });
  return service.update(owner, c.id, { expectedVersion: c.version, ...body(over) });
};
const launched = async (over: Record<string, unknown> = {}) => {
  const d = await draft(over);
  return service.launch(owner, d.id, d.version);
};

describe('access', () => {
  it('needs an active business', async () => {
    await expect(service.list(null, {})).rejects.toMatchObject({
      status: 403,
      code: 'NO_ACTIVE_BUSINESS',
    });
  });

  it('lets analysts read but not act, and operators pause and resume but not change', async () => {
    const c = await launched();
    expect(await service.list(analyst, {})).toHaveLength(1);
    expect(await service.get(analyst, c.id)).toMatchObject({ id: c.id });
    for (const attempt of [
      () => service.create(analyst, { title: 'x' }),
      () => service.pause(analyst, c.id, c.version),
      () => service.resume(analyst, c.id, c.version),
      () => service.cancel(analyst, c.id, c.version),
      () => service.duplicate(analyst, c.id),
      () => service.remove(analyst, c.id),
      () => service.launch(operator, c.id, c.version),
      () => service.cancel(operator, c.id, c.version),
      () => service.update(operator, c.id, { expectedVersion: 1, ...body() }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    }
    const paused = await service.pause(operator, c.id, c.version);
    expect(paused.status).toBe('PAUSED');
    expect((await service.resume(operator, c.id, paused.version)).status).toBe('LIVE');
  });

  it('never reaches another business', async () => {
    const c = await draft();
    const stranger: Actor = { ...owner, tenantId: randomUUID() };
    await expect(service.get(stranger, c.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.list(stranger, {})).toEqual([]);
  });
});

describe('drafting', () => {
  it('creates a draft, with or without a template, and rejects one that is not available', async () => {
    expect((await service.create(owner, { title: 'A' })).template).toBeNull();
    expect(
      (await service.create(owner, { title: 'B', templateId: published.id })).template,
    ).toMatchObject({ name: 'Entry' });
    await expect(
      service.create(owner, { title: 'C', templateId: randomUUID() }),
    ).rejects.toMatchObject({ status: 422, code: 'CAMPAIGN_INVALID' });
  });

  it('saves the content, trims it and returns the template', async () => {
    const c = await draft();
    expect(c).toMatchObject({
      title: 'Black Friday',
      summary: 'Win big',
      version: 2,
      status: 'DRAFT',
    });
    expect(c.template).toMatchObject({ id: published.id, archetype: 'giveaway' });
    expect(c.prizes).toHaveLength(1);
  });

  it('rejects an end before the start and an unavailable template', async () => {
    const c = await service.create(owner, { title: 'x' });
    await expect(
      service.update(owner, c.id, {
        expectedVersion: 1,
        ...body({ startAt: hours(10), endAt: hours(5) }),
      }),
    ).rejects.toMatchObject({ status: 422, code: 'CAMPAIGN_INVALID' });
    await expect(
      service.update(owner, c.id, { expectedVersion: 1, ...body({ templateId: randomUUID() }) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('answers 412 for a stale save and 409 once launched', async () => {
    const c = await draft();
    await expect(
      service.update(owner, c.id, { expectedVersion: 1, ...body() }),
    ).rejects.toMatchObject({ status: 412, code: 'VERSION_CONFLICT' });
    const live = await service.launch(owner, c.id, c.version);
    await expect(
      service.update(owner, c.id, { expectedVersion: live.version, ...body() }),
    ).rejects.toMatchObject({ status: 409, code: 'CAMPAIGN_LOCKED' });
  });
});

describe('launching', () => {
  it('goes live now and fixes the public address from the title', async () => {
    const c = await launched();
    expect(c).toMatchObject({ status: 'LIVE', slug: 'black-friday-s1', version: 3 });
    expect(c.launchedAt).toBeTruthy();
  });

  it('waits for a start in the future', async () => {
    expect((await launched({ startAt: hours(5) })).status).toBe('SCHEDULED');
  });

  it('retries when the address is taken', async () => {
    repo.takenSlugs.add('black-friday-s1');
    expect((await launched()).slug).toBe('black-friday-s2');
  });

  it('refuses with the failed checks named, and changes nothing', async () => {
    const c = await draft({ title: 'x', templateId: null, endAt: null, prizes: [] });
    await expect(service.launch(owner, c.id, c.version)).rejects.toMatchObject({
      status: 422,
      code: 'PREFLIGHT_FAILED',
      details: { failed: ['template', 'schedule'] },
    });
    expect(await service.get(owner, c.id)).toMatchObject({ status: 'DRAFT', slug: null });
  });

  it('refuses a template that is not published, and prizes a giveaway needs', async () => {
    const unpublished = templates.add({ ...published, id: randomUUID(), status: 'DRAFT' });
    const a = await draft({ templateId: unpublished.id });
    await expect(service.launch(owner, a.id, a.version)).rejects.toMatchObject({
      details: { failed: ['template'] },
    });
    const b = await draft({ prizes: [] });
    await expect(service.launch(owner, b.id, b.version)).rejects.toMatchObject({
      details: { failed: ['prizes'] },
    });
  });

  it('refuses an end that has already passed', async () => {
    const c = await draft({ endAt: hours(2) });
    now = new Date(NOW.getTime() + 3 * 3_600_000);
    await expect(service.launch(owner, c.id, c.version)).rejects.toMatchObject({
      details: { failed: ['schedule'] },
    });
  });

  it('refuses a stale version and a second launch', async () => {
    const c = await draft();
    await expect(service.launch(owner, c.id, 1)).rejects.toMatchObject({ status: 412 });
    const live = await service.launch(owner, c.id, c.version);
    await expect(service.launch(owner, c.id, live.version)).rejects.toMatchObject({
      status: 409,
      code: 'CAMPAIGN_STATE',
    });
  });
});

describe('running', () => {
  it('follows the schedule without anyone changing it', async () => {
    const c = await launched({ startAt: hours(5), endAt: hours(10) });
    expect(c.status).toBe('SCHEDULED');
    now = new Date(NOW.getTime() + 6 * 3_600_000);
    expect((await service.get(owner, c.id)).status).toBe('LIVE');
    now = new Date(NOW.getTime() + 11 * 3_600_000);
    expect((await service.get(owner, c.id)).status).toBe('COMPLETED');
    expect((await service.list(owner, { status: 'COMPLETED' })).map((x) => x.id)).toEqual([c.id]);
    expect(await service.list(owner, { status: 'LIVE' })).toEqual([]);
  });

  it('pauses and resumes, and resumes into a wait if the start is still ahead', async () => {
    const c = await launched({ startAt: hours(5) });
    const paused = await service.pause(owner, c.id, c.version);
    expect(paused.status).toBe('PAUSED');
    await expect(service.pause(owner, c.id, paused.version)).rejects.toMatchObject({
      status: 409,
      code: 'CAMPAIGN_STATE',
    });
    expect((await service.resume(owner, c.id, paused.version)).status).toBe('SCHEDULED');
  });

  it('refuses to pause, resume or cancel one that has ended', async () => {
    const c = await launched({ endAt: hours(2) });
    now = new Date(NOW.getTime() + 3 * 3_600_000);
    await expect(service.pause(owner, c.id, c.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
    await expect(service.resume(owner, c.id, c.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
    await expect(service.cancel(owner, c.id, c.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
  });

  it('cancels a running campaign for good, and refuses a stale version', async () => {
    const c = await launched();
    await expect(service.cancel(owner, c.id, 1)).rejects.toMatchObject({ status: 412 });
    const cancelled = await service.cancel(owner, c.id, c.version);
    expect(cancelled.status).toBe('CANCELLED');
    await expect(service.resume(owner, c.id, cancelled.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
  });
});

describe('duplicating and deleting', () => {
  it('copies as a draft without schedule or address', async () => {
    const c = await launched();
    const copy = await service.duplicate(owner, c.id);
    expect(copy).toMatchObject({
      title: 'Black Friday (copy)',
      status: 'DRAFT',
      slug: null,
      endAt: null,
      version: 1,
    });
    expect(copy.prizes).toHaveLength(1);
    expect(copy.template?.id).toBe(published.id);
  });

  it('keeps a long copy title within the limit', async () => {
    const c = await service.create(owner, { title: 'x'.repeat(120) });
    expect((await service.duplicate(owner, c.id)).title).toHaveLength(120);
  });

  it('deletes drafts only', async () => {
    const d = await draft();
    await service.remove(owner, d.id);
    await expect(service.get(owner, d.id)).rejects.toMatchObject({ status: 404 });
    const live = await launched();
    await expect(service.remove(owner, live.id)).rejects.toMatchObject({
      status: 409,
      code: 'CAMPAIGN_LOCKED',
    });
    await expect(service.remove(owner, randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it('shows a deleted template as unavailable instead of failing', async () => {
    const c = await draft();
    const gone = new FakeTemplateLookup();
    const later = new CampaignsService(repo, gone, () => now);
    expect((await later.get(owner, c.id)).template).toBeNull();
    const failed = await later.launch(owner, c.id, c.version).catch((e) => e);
    expect(failed.details).toEqual({ failed: ['template'] });
  });
});
