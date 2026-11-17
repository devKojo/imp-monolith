import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CampaignsService } from '../application/campaigns.service';
import type { Actor } from '../domain/model';
import { FakeTemplateLookup, InMemoryCampaignRepository } from './fakes';
import {
  detailsDraft,
  draftField,
  giveawayTemplate,
  quizQuestion,
  quizSettings,
  quizTemplate,
  surveyTemplate,
} from './fixtures';

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
const published = giveawayTemplate;

beforeEach(() => {
  now = NOW;
  n = 0;
  templates = new FakeTemplateLookup();
  templates.add(published);
  templates.add(quizTemplate);
  templates.add(surveyTemplate);
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
  fields: detailsDraft(),
  settings: { quiz: null as null | typeof quizSettings.quiz },
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
    ).toMatchObject({ name: 'Giveaway' });
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

describe('fields', () => {
  it('starts a new campaign with what its type begins with', async () => {
    const c = await service.create(owner, { title: 'G', templateId: published.id });
    expect(c.fields.map((f) => [f.kind, f.key, f.label, f.required])).toEqual([
      ['email', 'email', 'Email address', true],
      ['consent', 'consent', 'I agree to the rules and the privacy notice', true],
    ]);
    const quiz = await service.create(owner, { title: 'Q', templateId: quizTemplate.id });
    expect(quiz.settings).toEqual({
      quiz: { timeLimitMinutes: null, passPercent: 70, maxAttempts: 1 },
    });
    expect((await service.create(owner, { title: 'None' })).fields).toEqual([]);
  });

  it('keeps only what the type allows, and no more of a kind than it allows', async () => {
    const c = await service.create(owner, { title: 'x', templateId: published.id });
    const save = (
      fields: ReturnType<typeof draftField>[],
      templateId: string | null = published.id,
    ) =>
      service.update(owner, c.id, { expectedVersion: c.version, ...body({ fields, templateId }) });
    await expect(save([quizQuestion()])).rejects.toMatchObject({
      status: 422,
      code: 'CAMPAIGN_INVALID',
    });
    await expect(save([draftField('email'), draftField('email')])).rejects.toMatchObject({
      status: 422,
    });
    await expect(save([draftField('email')], null)).rejects.toMatchObject({ status: 422 });
    await expect(save([draftField('choice')], surveyTemplate.id)).resolves.toMatchObject({
      fields: [{ kind: 'choice' }],
    });
  });

  it('names fields, trims text, and keeps a correct answer only on a quiz question', async () => {
    const c = await service.create(owner, { title: 'x' });
    const saved = await service.update(owner, c.id, {
      expectedVersion: c.version,
      ...body({
        templateId: quizTemplate.id,
        settings: quizSettings,
        prizes: [],
        fields: [
          draftField('email', {
            label: ' Email ',
            required: true,
            options: ['junk'],
            correctIndex: 1,
          }),
          quizQuestion({
            label: ' Q1 ',
            options: [' A ', ' B '],
            correctIndex: 1,
            required: false,
          }),
          quizQuestion({ label: 'Q2', options: ['A', 'B'], correctIndex: 7 }),
        ],
      }),
    });
    expect(saved.fields.map((f) => f.key)).toEqual(['email', 'quiz_question', 'quiz_question_2']);
    expect(saved.fields[0]).toMatchObject({ label: 'Email', options: [], correctIndex: null });
    expect(saved.fields[1]).toMatchObject({
      label: 'Q1',
      options: ['A', 'B'],
      correctIndex: 1,
      required: true,
    });
    expect(saved.fields[2]!.correctIndex).toBeNull(); // out of range is dropped, so launch will ask for it
  });

  it('keeps quiz settings only for a quiz', async () => {
    const c = await service.create(owner, { title: 'x' });
    const asGiveaway = await service.update(owner, c.id, {
      expectedVersion: c.version,
      ...body({ settings: quizSettings }),
    });
    expect(asGiveaway.settings).toEqual({});
    const asQuiz = await service.update(owner, c.id, {
      expectedVersion: asGiveaway.version,
      ...body({
        templateId: quizTemplate.id,
        prizes: [],
        fields: [],
        settings: { quiz: { timeLimitMinutes: 15, passPercent: 80, maxAttempts: 1 } },
      }),
    });
    expect(asQuiz.settings).toEqual({
      quiz: { timeLimitMinutes: 15, passPercent: 80, maxAttempts: 1 },
    });
  });

  it('copies fields and settings when duplicating', async () => {
    const c = await service.create(owner, { title: 'x' });
    const saved = await service.update(owner, c.id, {
      expectedVersion: c.version,
      ...body({
        templateId: quizTemplate.id,
        prizes: [],
        settings: quizSettings,
        fields: [...detailsDraft(), quizQuestion()],
      }),
    });
    const copy = await service.duplicate(owner, saved.id);
    expect(copy.fields.map((f) => f.key)).toEqual(saved.fields.map((f) => f.key));
    expect(copy.fields.map((f) => f.id)).not.toEqual(saved.fields.map((f) => f.id));
    expect(copy.settings).toEqual(saved.settings);
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
    const c = await draft({ title: 'x', templateId: null, endAt: null, prizes: [], fields: [] });
    await expect(service.launch(owner, c.id, c.version)).rejects.toMatchObject({
      status: 422,
      code: 'PREFLIGHT_FAILED',
      details: { failed: ['template', 'schedule', 'details'] },
    });
    expect(await service.get(owner, c.id)).toMatchObject({ status: 'DRAFT', slug: null });
  });

  it('refuses prizes a giveaway needs, and details a participant must give', async () => {
    const noPrizes = await draft({ prizes: [] });
    await expect(service.launch(owner, noPrizes.id, noPrizes.version)).rejects.toMatchObject({
      details: { failed: ['prizes'] },
    });
    const noDetails = await draft({ fields: [] });
    await expect(service.launch(owner, noDetails.id, noDetails.version)).rejects.toMatchObject({
      details: { failed: ['details'] },
    });
    const noConsent = await draft({
      fields: [draftField('email', { label: 'Email', required: true })],
    });
    await expect(service.launch(owner, noConsent.id, noConsent.version)).rejects.toMatchObject({
      details: { failed: ['details'] },
    });
  });

  it('refuses a quiz with no questions, or a question that is not finished', async () => {
    const quiz = { templateId: quizTemplate.id, settings: quizSettings, prizes: [] };
    const empty = await draft(quiz);
    await expect(service.launch(owner, empty.id, empty.version)).rejects.toMatchObject({
      details: { failed: ['content'] },
    });
    for (const broken of [
      quizQuestion({ correctIndex: null }),
      quizQuestion({ label: ' ' }),
      quizQuestion({ options: ['Accra', 'accra'] }),
      quizQuestion({ options: ['Accra'] }),
    ]) {
      const c = await draft({ ...quiz, fields: [...detailsDraft(), broken] });
      await expect(service.launch(owner, c.id, c.version)).rejects.toMatchObject({
        details: { failed: ['content'] },
      });
    }
    const ok = await draft({ ...quiz, fields: [...detailsDraft(), quizQuestion()] });
    expect((await service.launch(owner, ok.id, ok.version)).status).toBe('LIVE');
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

describe('publishing a cancelled campaign again', () => {
  it('puts it back live at the same address, keeping its version history moving', async () => {
    const c = await launched();
    const cancelled = await service.cancel(owner, c.id, c.version);
    const again = await service.republish(owner, c.id, cancelled.version);
    expect(again.status).toBe('LIVE');
    expect(again.slug).toBe(c.slug);
    expect(again.version).toBe(cancelled.version + 1);
  });

  it('refuses one that is not cancelled, or whose end date has passed', async () => {
    const c = await launched({ endAt: hours(2) });
    await expect(service.republish(owner, c.id, c.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
    const cancelled = await service.cancel(owner, c.id, c.version);
    now = new Date(NOW.getTime() + 3 * 3_600_000);
    await expect(service.republish(owner, c.id, cancelled.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
  });

  it('is for managers only', async () => {
    const c = await launched();
    const cancelled = await service.cancel(owner, c.id, c.version);
    await expect(service.republish(operator, c.id, cancelled.version)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('prize pools', () => {
  const pool = {
    kind: 'MONEY' as const,
    amount: 500_000,
    currency: 'GHS' as const,
    maxParticipants: 200,
  };
  const withPool = (over: Record<string, unknown> = {}) =>
    body({ prizes: [], settings: { quiz: null, pool }, ...over });

  it('keeps a pool instead of prize tiers and works out each share', async () => {
    const d = await draft({ ...withPool(), prizes: [prize] });
    expect(d.prizes).toEqual([]);
    expect(d.pool).toMatchObject({
      amount: 500_000,
      share: 2500,
      remainder: 0,
      label: expect.stringContaining('5,000'),
    });
    expect(d.pool?.shareLabel).toContain('25.00');
  });

  it('launches with a complete pool and no prize tiers', async () => {
    const c = await launched(withPool());
    expect(c.status).toBe('LIVE');
    expect(c.participantCount).toBe(0);
  });

  it('refuses to launch an unfinished pool, but lets a draft hold one', async () => {
    const half = { ...pool, amount: 0 };
    const d = await draft(withPool({ settings: { quiz: null, pool: half } }));
    await expect(service.launch(owner, d.id, d.version)).rejects.toMatchObject({
      code: 'PREFLIGHT_FAILED',
    });
  });

  it('can go back to prize tiers by dropping the pool', async () => {
    const d = await draft(withPool());
    const back = await service.update(owner, d.id, {
      expectedVersion: d.version,
      ...body({ prizes: [prize] }),
    });
    expect(back.pool).toBeNull();
    expect(back.prizes).toHaveLength(1);
  });

  it('lists how many seats a pool campaign has', async () => {
    await draft(withPool());
    expect((await service.list(owner, {}))[0]).toMatchObject({
      maxParticipants: 200,
      participantCount: 0,
    });
  });
});

describe('archiving', () => {
  const ids = async (archived?: boolean) =>
    (await service.list(owner, archived === undefined ? {} : { archived })).map((x) => x.id);

  it('puts a draft away, hides it from the default list and brings it back as it was', async () => {
    const d = await draft();
    const archived = await service.archive(owner, d.id, d.version);
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.status).toBe('DRAFT');
    expect(await ids()).toEqual([]);
    expect(await ids(true)).toEqual([d.id]);
    const back = await service.unarchive(owner, d.id, archived.version);
    expect(back).toMatchObject({ archivedAt: null, status: 'DRAFT' });
    expect(await ids()).toEqual([d.id]);
    expect(await ids(true)).toEqual([]);
  });

  it('archives a cancelled campaign and one that has ended', async () => {
    const a = await launched();
    const cancelled = await service.cancel(owner, a.id, a.version);
    expect((await service.archive(owner, a.id, cancelled.version)).status).toBe('CANCELLED');

    const b = await launched({ endAt: hours(2) });
    now = new Date(NOW.getTime() + 3 * 3_600_000);
    const done = await service.archive(owner, b.id, b.version);
    expect(done.status).toBe('COMPLETED');
    expect(done.archivedAt).not.toBeNull();
  });

  it('refuses to archive a running or paused campaign', async () => {
    const c = await launched();
    await expect(service.archive(owner, c.id, c.version)).rejects.toMatchObject({
      status: 409,
      code: 'CAMPAIGN_STATE',
    });
    const paused = await service.pause(owner, c.id, c.version);
    await expect(service.archive(owner, c.id, paused.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
  });

  it('refuses a stale version, a repeat, and unarchiving one that is not archived', async () => {
    const d = await draft();
    await expect(service.archive(owner, d.id, 1)).rejects.toMatchObject({ status: 412 });
    await expect(service.unarchive(owner, d.id, d.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
    const archived = await service.archive(owner, d.id, d.version);
    await expect(service.archive(owner, d.id, archived.version)).rejects.toMatchObject({
      code: 'CAMPAIGN_STATE',
    });
  });

  it('is for managers only', async () => {
    const d = await draft();
    for (const who of [operator, analyst]) {
      await expect(service.archive(who, d.id, d.version)).rejects.toMatchObject({ status: 403 });
    }
    const archived = await service.archive(owner, d.id, d.version);
    await expect(service.unarchive(operator, d.id, archived.version)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('keeps an archived draft from being edited, and its copy starts unarchived', async () => {
    const d = await draft();
    const archived = await service.archive(owner, d.id, d.version);
    await expect(
      service.update(owner, d.id, { expectedVersion: archived.version, ...body() }),
    ).rejects.toMatchObject({ status: 409 });
    const copy = await service.duplicate(owner, d.id);
    expect(copy.archivedAt).toBeNull();
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
