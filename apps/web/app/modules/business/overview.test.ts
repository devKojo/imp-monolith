// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  barsOfKinds,
  campaignBars,
  leadingOption,
  participationByType,
  kindSeries,
  standingsBars,
  statusCounts,
} from './overview';

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

describe('participationByType', () => {
  const items = [
    { kind: 'quiz' as const, started: 3 },
    { kind: 'poll' as const, started: 5 },
    { kind: 'poll' as const, started: 2 },
    { kind: 'vote' as const, started: 0 },
    { kind: 'giveaway' as const, started: 4 },
  ];
  it('adds up each type, in a fixed order, leaving out the empty ones', () => {
    expect(participationByType(items, (k) => k.toUpperCase())).toEqual([
      { label: 'QUIZ', value: 3 },
      { label: 'POLL', value: 7 },
      { label: 'GIVEAWAY', value: 4 },
    ]);
  });
});

describe('barsOfKinds', () => {
  const c = (title: string, kind: 'poll' | 'vote' | 'giveaway' | 'quiz', started: number) => ({
    campaignId: title,
    title,
    kind,
    started,
    completed: started,
  });
  it('keeps the chosen types, busiest first, and leaves out empty campaigns', () => {
    const bars = barsOfKinds(
      [
        c('A', 'poll', 2),
        c('B', 'vote', 9),
        c('C', 'giveaway', 5),
        c('D', 'poll', 0),
        c('E', 'quiz', 8),
      ],
      ['poll', 'vote'],
      'Votes',
    );
    expect(bars).toEqual([
      {
        name: 'Votes',
        points: [
          { label: 'B', value: 9 },
          { label: 'A', value: 2 },
        ],
      },
    ]);
  });
  it('is empty when no campaign of those types has any', () => {
    expect(barsOfKinds([c('A', 'quiz', 4)], ['giveaway'], 'Entries')).toEqual([]);
  });
});

describe('ballot standings', () => {
  const results = {
    total: 10,
    options: [
      { index: 0, label: 'Ama', description: '', imageUrl: '', votes: 3, percent: 30 },
      { index: 1, label: 'Kofi', description: '', imageUrl: '', votes: 7, percent: 70 },
    ],
  };
  it('lists options by votes and names the leader', () => {
    expect(standingsBars(results, 'Votes')[0]!.points).toEqual([
      { label: 'Kofi', value: 7 },
      { label: 'Ama', value: 3 },
    ]);
    expect(leadingOption(results)).toEqual({ label: 'Kofi', votes: 7 });
  });
  it('has no leader before the first vote', () => {
    expect(leadingOption({ total: 0, options: results.options })).toBeNull();
  });
});

describe('kindSeries', () => {
  const daily = [{ date: '2026-11-19' }, { date: '2026-11-20' }];
  it('makes one line per type that had participation, in a fixed order', () => {
    const series = kindSeries(
      daily,
      { quiz: [0, 0], poll: [1, 2], vote: [0, 3], giveaway: [4, 0], survey: [0, 0] },
      (k) => k.toUpperCase(),
      (d) => d.slice(5),
    );
    expect(series.map((s) => s.name)).toEqual(['POLL', 'VOTE', 'GIVEAWAY']);
    expect(series[0]!.points.map((p) => p.label)).toEqual(['11-19', '11-20']);
    expect(series[0]!.points.map((p) => p.value)).toEqual([1, 2]);
    expect(series[2]!.points.map((p) => p.value)).toEqual([4, 0]);
    expect(series[0]!.points).toHaveLength(2);
  });
  it('is empty when nothing happened', () => {
    expect(
      kindSeries(
        daily,
        { quiz: [0, 0] },
        (k) => k,
        (d) => d,
      ),
    ).toEqual([]);
    expect(
      kindSeries(
        daily,
        {},
        (k) => k,
        (d) => d,
      ),
    ).toEqual([]);
  });
});
