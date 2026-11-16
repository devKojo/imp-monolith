// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  addPrize,
  fromParts,
  isArchivable,
  isLaunchable,
  movePrize,
  newPrize,
  preflight,
  removePrize,
  toParts,
  updatePrize,
  winnersLabelKey,
} from './logic';
import type { CampaignField, Prize, TemplateRef } from './types';

const NOW = new Date('2026-11-14T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString();
const template = (over: Partial<TemplateRef> = {}): TemplateRef => ({
  id: 't1',
  slug: 'giveaway',
  name: 'Giveaway',
  archetype: 'giveaway',
  description: '',
  minContentFields: 0,
  requiresPrizes: true,
  fields: [],
  ...over,
});
const quiz = (): TemplateRef =>
  template({ archetype: 'quiz', slug: 'quiz', requiresPrizes: false, minContentFields: 1 });
const field = (kind: CampaignField['kind'], over: Partial<CampaignField> = {}): CampaignField => ({
  id: `${kind}-${Math.random()}`,
  kind,
  key: kind,
  label: kind,
  helper: '',
  required: false,
  options: kind === 'quiz_question' || kind === 'choice' ? ['A', 'B'] : [],
  correctIndex: null,
  ...over,
});
const details = () => [field('email', { required: true }), field('consent', { required: true })];
const prize = (id: string, name = 'Prize'): Prize => ({
  id,
  name,
  valueLabel: '',
  winners: 1,
  description: '',
});
const campaign = (over: Record<string, unknown> = {}) => ({
  title: 'Launch',
  template: template(),
  startAt: null as string | null,
  endAt: hours(48) as string | null,
  prizes: [prize('p1')],
  fields: details(),
  ...over,
});
const passes = (over: Record<string, unknown> = {}) =>
  Object.fromEntries(preflight(campaign(over), NOW).map((c) => [c.id, c.pass]));

describe('isArchivable', () => {
  it('allows a draft and a finished campaign, never a running or paused one', () => {
    for (const s of ['DRAFT', 'COMPLETED', 'CANCELLED']) expect(isArchivable(s)).toBe(true);
    for (const s of ['SCHEDULED', 'LIVE', 'PAUSED']) expect(isArchivable(s)).toBe(false);
  });
});

describe('prizes', () => {
  it('adds, updates, removes and moves without touching the input', () => {
    const all = [prize('a'), prize('b'), prize('c')];
    const before = JSON.stringify(all);
    expect(addPrize(all, prize('d')).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(updatePrize(all, 'b', { winners: 5 })[1]).toMatchObject({ id: 'b', winners: 5 });
    expect(removePrize(all, 'a').map((p) => p.id)).toEqual(['b', 'c']);
    expect(movePrize(all, 'b', -1).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(movePrize(all, 'a', -1).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(movePrize(all, 'c', 1).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(JSON.stringify(all)).toBe(before);
  });

  it('starts a new prize with one winner and no text', () => {
    expect(newPrize('x')).toEqual({
      id: 'x',
      name: '',
      valueLabel: '',
      winners: 1,
      description: '',
    });
  });

  it('says "1 winner" and "N winners"', () => {
    expect(winnersLabelKey(1)).toBe('cmp.preview.winners.one');
    expect(winnersLabelKey(3)).toBe('cmp.preview.winners.other');
  });
});

describe('launch checks', () => {
  it('passes a complete giveaway', () => {
    expect(isLaunchable(campaign(), NOW)).toBe(true);
  });

  it('needs a title and a template', () => {
    expect(passes({ title: '  ' }).title).toBe(false);
    expect(passes({ template: null }).template).toBe(false);
  });

  it('needs an end in the future, after any start', () => {
    expect(passes({ endAt: null }).schedule).toBe(false);
    expect(passes({ endAt: hours(-1) }).schedule).toBe(false);
    expect(passes({ startAt: hours(10), endAt: hours(5) }).schedule).toBe(false);
    expect(passes({ startAt: hours(1), endAt: hours(5) }).schedule).toBe(true);
  });

  it('requires prizes for giveaways and instant wins only, but rejects unfinished ones', () => {
    expect(passes({ prizes: [] }).prizes).toBe(false);
    expect(passes({ template: template({ archetype: 'instant' }), prizes: [] }).prizes).toBe(false);
    expect(passes({ template: quiz(), prizes: [] }).prizes).toBe(true);
    expect(passes({ template: quiz(), prizes: [prize('p', ' ')] }).prizes).toBe(false);
    expect(passes({ prizes: [{ ...prize('p'), winners: 0 }] }).prizes).toBe(false);
  });
});

describe('date and time fields', () => {
  it('shows an instant as the wall clock in a zone', () => {
    expect(toParts('2026-11-14T12:30:00.000Z', 'UTC')).toEqual({
      date: '2026-11-14',
      time: '12:30',
      zone: 'UTC',
    });
    expect(toParts('2026-11-14T12:30:00.000Z', 'Africa/Accra')).toMatchObject({
      date: '2026-11-14',
      time: '12:30',
    });
    expect(toParts('2026-11-14T23:30:00.000Z', 'Asia/Tokyo')).toMatchObject({
      date: '2026-11-15',
      time: '08:30',
    });
  });

  it('turns what was typed back into the same instant, across zones and daylight saving', () => {
    for (const zone of [
      'UTC',
      'Africa/Accra',
      'America/New_York',
      'Europe/London',
      'Asia/Kolkata',
    ]) {
      for (const iso of [
        '2026-11-14T12:30:00.000Z',
        '2026-07-01T03:15:00.000Z',
        '2026-03-29T01:30:00.000Z',
      ]) {
        expect(fromParts(toParts(iso, zone))).toBe(iso);
      }
    }
  });

  it('gives nothing while the date or time is missing or invalid', () => {
    expect(fromParts({ date: '', time: '10:00', zone: 'UTC' })).toBeNull();
    expect(fromParts({ date: '2026-11-14', time: '', zone: 'UTC' })).toBeNull();
    expect(fromParts({ date: 'nope', time: '10:00', zone: 'UTC' })).toBeNull();
    expect(toParts(null, 'UTC')).toEqual({ date: '', time: '', zone: 'UTC' });
  });
});

describe('details and content at launch', () => {
  const quizQuestion = (over: Partial<CampaignField> = {}) =>
    field('quiz_question', { label: 'Q?', options: ['A', 'B'], correctIndex: 0, ...over });
  const passesQuiz = (fields: CampaignField[]) =>
    Object.fromEntries(
      preflight(campaign({ template: quiz(), prizes: [], fields }), NOW).map((c) => [c.id, c.pass]),
    );

  it('needs a way to reach the participant and a required consent', () => {
    expect(passes().details).toBe(true);
    expect(passes({ fields: [] }).details).toBe(false);
    expect(passes({ fields: [field('email')] }).details).toBe(false);
    expect(passes({ fields: [field('email', { required: true }), field('consent')] }).details).toBe(
      false,
    );
    expect(
      passes({ fields: [field('phone', { required: true }), field('consent', { required: true })] })
        .details,
    ).toBe(true);
  });

  it('asks a quiz for at least one finished question', () => {
    expect(passesQuiz(details()).content).toBe(false);
    expect(passesQuiz([...details(), quizQuestion()]).content).toBe(true);
    expect(passes().content).toBe(true); // a giveaway needs no questions
  });

  it('rejects an unfinished question, however many there are', () => {
    for (const q of [
      quizQuestion({ label: ' ' }),
      quizQuestion({ correctIndex: null }),
      quizQuestion({ options: ['A', ''] }),
      quizQuestion({ options: ['A', 'a'] }),
    ]) {
      expect(passesQuiz([...details(), quizQuestion(), q]).content).toBe(false);
    }
  });
});
