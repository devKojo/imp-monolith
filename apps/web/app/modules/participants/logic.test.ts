// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  durationParts,
  activitySeries,
  busiestDay,
  campaignChoices,
  completionPercent,
  dayLabel,
  funnelPoints,
  minutesBetween,
  outcomePoints,
} from './logic';
import { canViewParticipants } from './permissions';

describe('completionPercent', () => {
  it('is the share completed, rounded, and 0 when nothing started', () => {
    expect(completionPercent(0, 0)).toBe(0);
    expect(completionPercent(3, 1)).toBe(33);
    expect(completionPercent(4, 4)).toBe(100);
  });
});

describe('campaignChoices', () => {
  it('starts with "all" and then each campaign in the order given', () => {
    expect(
      campaignChoices(
        [
          { campaignId: 'a', title: 'A', kind: 'quiz', started: 2, completed: 1 },
          { campaignId: 'b', title: 'B', kind: 'survey', started: 1, completed: 0 },
        ],
        'All campaigns',
      ),
    ).toEqual([
      { value: '', label: 'All campaigns' },
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
  });
});

describe('canViewParticipants', () => {
  it('is for the people who run the business and analysts', () => {
    expect(canViewParticipants('BUSINESS_OWNER')).toBe(true);
    expect(canViewParticipants('ANALYST')).toBe(true);
    expect(canViewParticipants('MODERATOR')).toBe(false);
    expect(canViewParticipants('CAMPAIGN_OPERATOR')).toBe(false);
    expect(canViewParticipants(undefined)).toBe(false);
  });
});

describe('chart helpers', () => {
  const daily = [
    { date: '2026-11-14', started: 0, completed: 0 },
    { date: '2026-11-15', started: 3, completed: 1 },
    { date: '2026-11-16', started: 5, completed: 2 },
  ];
  const labels = { started: 'Started', completed: 'Completed', passed: 'Passed' };

  it('labels a UTC day the same on every device', () => {
    expect(dayLabel('2026-11-16')).toBe('16 Nov');
    expect(dayLabel('2026-01-02')).toBe('2 Jan');
  });

  it('builds the funnel, with a passed step only for a quiz', () => {
    expect(
      funnelPoints({ started: 4, completed: 3, quiz: null }, labels).map((p) => p.value),
    ).toEqual([4, 3]);
    const quiz = { passed: 2, failed: 1, correctPercent: 60 };
    expect(funnelPoints({ started: 4, completed: 3, quiz }, labels)).toEqual([
      { label: 'Started', value: 4 },
      { label: 'Completed', value: 3 },
      { label: 'Passed', value: 2 },
    ]);
  });

  it('builds a started and a completed series over the same days', () => {
    const series = activitySeries(daily, { started: 'Started', completed: 'Completed' });
    expect(series.map((s) => s.name)).toEqual(['Started', 'Completed']);
    expect(series[0]!.points.map((p) => p.value)).toEqual([0, 3, 5]);
    expect(series[1]!.points.map((p) => p.label)).toEqual(['14 Nov', '15 Nov', '16 Nov']);
  });

  it('finds the busiest day, or none when nothing happened', () => {
    expect(busiestDay(daily)).toEqual({ date: '2026-11-16', started: 5 });
    expect(busiestDay(daily.map((d) => ({ ...d, started: 0 })))).toBeNull();
  });

  it('measures minutes, at least one', () => {
    expect(minutesBetween('2026-11-16T10:00:00Z', '2026-11-16T10:00:20Z')).toBe(1);
    expect(minutesBetween('2026-11-16T10:00:00Z', '2026-11-16T10:12:00Z')).toBe(12);
  });

  it('splits a length of time into the two units that read best', () => {
    expect(durationParts(12)).toEqual({ unit: 'min', a: 12, b: 0 });
    expect(durationParts(135)).toEqual({ unit: 'hours', a: 2, b: 15 });
    expect(durationParts(1440)).toEqual({ unit: 'days', a: 1, b: 0 });
    expect(durationParts(3000)).toEqual({ unit: 'days', a: 2, b: 2 });
  });
});

describe('outcomePoints', () => {
  const labels = {
    completed: 'Completed',
    passed: 'Passed',
    notPassed: 'Not passed',
    inProgress: 'In progress',
  };
  it('splits a quiz into passed, not passed and still in progress', () => {
    const quiz = { passed: 2, failed: 1, correctPercent: 60 };
    expect(outcomePoints({ started: 5, completed: 3, quiz }, labels)).toEqual([
      { label: 'Passed', value: 2 },
      { label: 'Not passed', value: 1 },
      { label: 'In progress', value: 2 },
    ]);
  });
  it('splits a survey into completed and still in progress', () => {
    expect(outcomePoints({ started: 4, completed: 1, quiz: null }, labels)).toEqual([
      { label: 'Completed', value: 1 },
      { label: 'In progress', value: 3 },
    ]);
  });
});
