// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { campaignBars, shortLabel, statusCounts } from './overview';

describe('statusCounts', () => {
  const label = (k: string) => k.toUpperCase();
  it('counts campaigns by group, treating finished and cancelled as ended', () => {
    const items = [
      { status: 'LIVE' },
      { status: 'LIVE' },
      { status: 'DRAFT' },
      { status: 'COMPLETED' },
      { status: 'CANCELLED' },
      { status: 'PAUSED' },
    ];
    expect(statusCounts(items, label)).toEqual([
      { label: 'LIVE', value: 2 },
      { label: 'DRAFT', value: 1 },
      { label: 'PAUSED', value: 1 },
      { label: 'ENDED', value: 2 },
    ]);
  });
  it('is empty when there are no campaigns', () => {
    expect(statusCounts([], label)).toEqual([]);
  });
});

describe('shortLabel', () => {
  it('keeps a short title and cuts a long one with an ellipsis', () => {
    expect(shortLabel('Quiz')).toBe('Quiz');
    expect(shortLabel('Community Pulse Survey')).toBe('Community Pul…');
    expect(shortLabel('abcdef', 4)).toBe('abc…');
  });
});

describe('campaignBars', () => {
  const campaigns = ['A', 'B', 'C'].map((title, i) => ({
    campaignId: String(i),
    title,
    kind: 'quiz' as const,
    started: 10 - i,
    completed: 5 - i,
  }));
  it('makes started and completed series over the first campaigns', () => {
    const series = campaignBars(campaigns, { started: 'Started', completed: 'Completed' }, 2);
    expect(series.map((s) => s.name)).toEqual(['Started', 'Completed']);
    expect(series[0]!.points).toEqual([
      { label: 'A', value: 10 },
      { label: 'B', value: 9 },
    ]);
    expect(series[1]!.points.map((p) => p.value)).toEqual([5, 4]);
  });
});
