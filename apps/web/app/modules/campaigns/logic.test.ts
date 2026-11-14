// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  addPrize,
  fromParts,
  isLaunchable,
  movePrize,
  newPrize,
  preflight,
  removePrize,
  toParts,
  updatePrize,
  winnersLabelKey,
} from './logic';
import type { Prize, TemplateRef } from './types';

const NOW = new Date('2026-11-14T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString();
const template = (over: Partial<TemplateRef> = {}): TemplateRef => ({
  id: 't1',
  name: 'Entry',
  archetype: 'giveaway',
  status: 'PUBLISHED',
  ...over,
});
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
  ...over,
});
const passes = (over: Record<string, unknown> = {}) =>
  Object.fromEntries(preflight(campaign(over), NOW).map((c) => [c.id, c.pass]));

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

  it('needs a title and a published template', () => {
    expect(passes({ title: '  ' }).title).toBe(false);
    expect(passes({ template: null }).template).toBe(false);
    expect(passes({ template: template({ status: 'DRAFT' }) }).template).toBe(false);
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
    expect(passes({ template: template({ archetype: 'quiz' }), prizes: [] }).prizes).toBe(true);
    expect(
      passes({ template: template({ archetype: 'quiz' }), prizes: [prize('p', ' ')] }).prizes,
    ).toBe(false);
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
