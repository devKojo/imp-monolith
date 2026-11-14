import { describe, expect, it } from 'vitest';
import type { TemplateRef } from '../domain/model';
import { canManageCampaigns, canOperateCampaigns, canReadCampaigns } from '../domain/permissions';
import {
  effectiveStatus,
  failedChecks,
  normalizePrizes,
  preflight,
  runningStatusFor,
  slugify,
} from '../domain/rules';

const NOW = new Date('2026-11-14T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);
const template = (over: Partial<TemplateRef> = {}): TemplateRef => ({
  id: 't1',
  name: 'Entry',
  archetype: 'giveaway',
  status: 'PUBLISHED',
  ...over,
});
const prize = { name: 'Grand prize', valueLabel: '1,000', winners: 1, description: '' };
const input = (over: Partial<Parameters<typeof preflight>[0]> = {}) => ({
  title: 'Launch',
  template: template(),
  startAt: null,
  endAt: hours(48),
  prizes: [prize],
  ...over,
});

describe('effectiveStatus', () => {
  it('starts a scheduled campaign at its start time', () => {
    expect(effectiveStatus('SCHEDULED', hours(2), hours(48), NOW)).toBe('SCHEDULED');
    expect(effectiveStatus('SCHEDULED', hours(-1), hours(48), NOW)).toBe('LIVE');
    expect(effectiveStatus('SCHEDULED', hours(0), hours(48), NOW)).toBe('LIVE');
  });

  it('completes anything still running at its end time', () => {
    for (const s of ['SCHEDULED', 'LIVE', 'PAUSED'] as const) {
      expect(effectiveStatus(s, hours(-5), hours(-1), NOW)).toBe('COMPLETED');
    }
    expect(effectiveStatus('LIVE', null, hours(1), NOW)).toBe('LIVE');
  });

  it('leaves drafts, cancelled and completed campaigns as they are', () => {
    expect(effectiveStatus('DRAFT', null, hours(-1), NOW)).toBe('DRAFT');
    expect(effectiveStatus('CANCELLED', null, hours(-1), NOW)).toBe('CANCELLED');
    expect(effectiveStatus('COMPLETED', null, hours(-1), NOW)).toBe('COMPLETED');
    expect(effectiveStatus('PAUSED', null, hours(5), NOW)).toBe('PAUSED');
  });

  it('launches live now, or waits for a start in the future', () => {
    expect(runningStatusFor(null, NOW)).toBe('LIVE');
    expect(runningStatusFor(hours(-1), NOW)).toBe('LIVE');
    expect(runningStatusFor(hours(1), NOW)).toBe('SCHEDULED');
  });
});

describe('slugify', () => {
  it('makes lowercase ascii words joined by single hyphens', () => {
    expect(slugify('Win a Prize!')).toBe('win-a-prize');
    expect(slugify('  Café   Déjà-vu  ')).toBe('cafe-deja-vu');
    expect(slugify('Black Friday 2026')).toBe('black-friday-2026');
  });

  it('never returns an empty or over-long slug', () => {
    expect(slugify('!!!')).toBe('campaign');
    expect(slugify('日本語')).toBe('campaign');
    const long = slugify('word '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('preflight', () => {
  const passes = (over = {}, now = NOW) =>
    Object.fromEntries(preflight(input(over), now).map((c) => [c.id, c.pass]));

  it('passes a complete giveaway', () => {
    expect(failedChecks(input(), NOW)).toEqual([]);
  });

  it('needs a title and a published template', () => {
    expect(passes({ title: '   ' }).title).toBe(false);
    expect(passes({ template: null }).template).toBe(false);
    expect(passes({ template: template({ status: 'DRAFT' }) }).template).toBe(false);
  });

  it('needs an end in the future, after any start', () => {
    expect(passes({ endAt: null }).schedule).toBe(false);
    expect(passes({ endAt: hours(-1) }).schedule).toBe(false);
    expect(passes({ startAt: hours(10), endAt: hours(5) }).schedule).toBe(false);
    expect(passes({ startAt: hours(1), endAt: hours(5) }).schedule).toBe(true);
  });

  it('requires prizes for giveaways and instant wins, but not for quizzes and surveys', () => {
    expect(passes({ prizes: [] }).prizes).toBe(false);
    expect(passes({ template: template({ archetype: 'instant' }), prizes: [] }).prizes).toBe(false);
    expect(passes({ template: template({ archetype: 'quiz' }), prizes: [] }).prizes).toBe(true);
    expect(passes({ template: template({ archetype: 'survey' }), prizes: [] }).prizes).toBe(true);
  });

  it('rejects an unfinished prize whatever the template', () => {
    const quiz = template({ archetype: 'quiz' });
    expect(passes({ template: quiz, prizes: [{ ...prize, name: ' ' }] }).prizes).toBe(false);
    expect(passes({ template: quiz, prizes: [{ ...prize, winners: 0 }] }).prizes).toBe(false);
  });
});

describe('normalizePrizes', () => {
  it('trims text and keeps the winner count', () => {
    expect(
      normalizePrizes([{ name: ' A ', valueLabel: ' 5 ', winners: 3, description: ' x ' }]),
    ).toEqual([{ name: 'A', valueLabel: '5', winners: 3, description: 'x' }]);
  });
});

describe('permissions', () => {
  it('lets everyone read, operators pause and resume, and only managers change', () => {
    for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']) {
      expect([canReadCampaigns(role), canOperateCampaigns(role), canManageCampaigns(role)]).toEqual(
        [true, true, true],
      );
    }
    expect([
      canReadCampaigns('CAMPAIGN_OPERATOR'),
      canOperateCampaigns('CAMPAIGN_OPERATOR'),
      canManageCampaigns('CAMPAIGN_OPERATOR'),
    ]).toEqual([true, true, false]);
    for (const role of ['ANALYST', 'MODERATOR']) {
      expect([canReadCampaigns(role), canOperateCampaigns(role), canManageCampaigns(role)]).toEqual(
        [true, false, false],
      );
    }
    expect(canReadCampaigns('PARTICIPANT')).toBe(false);
  });
});
