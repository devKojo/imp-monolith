import type { CampaignActivity, CampaignParticipation } from './types';

/** Share of started that were completed, as a whole percent; 0 when nothing started. */
export const completionPercent = (started: number, completed: number): number =>
  started <= 0 ? 0 : Math.round((completed / started) * 100);

/** The campaign choices for the filter: those with any participation, most active first (as the API sends them). */
export function campaignChoices(
  campaigns: readonly CampaignParticipation[],
  allLabel: string,
): Array<{ value: string; label: string }> {
  return [
    { value: '', label: allLabel },
    ...campaigns.map((c) => ({ value: c.campaignId, label: c.title })),
  ];
}

/** "16 Nov" for a UTC date like 2026-11-16, the same on every device. */
export const dayLabel = (isoDate: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );

/**
 * How everyone who started a campaign is spread: a quiz splits those who finished into passed and not
 * passed, a survey just counts those who finished; the rest are still in progress.
 */
export function outcomePoints(
  a: Pick<CampaignActivity, 'started' | 'completed' | 'quiz'>,
  labels: { completed: string; passed: string; notPassed: string; inProgress: string },
): Array<{ label: string; value: number }> {
  const inProgress = Math.max(0, a.started - a.completed);
  return [
    ...(a.quiz
      ? [
          { label: labels.passed, value: a.quiz.passed },
          { label: labels.notPassed, value: a.quiz.failed },
        ]
      : [{ label: labels.completed, value: a.completed }]),
    { label: labels.inProgress, value: inProgress },
  ];
}

/** The funnel of a campaign: started, completed and, for a quiz, passed. */
export function funnelPoints(
  a: Pick<CampaignActivity, 'started' | 'completed' | 'quiz'>,
  labels: { started: string; completed: string; passed: string },
): Array<{ label: string; value: number }> {
  return [
    { label: labels.started, value: a.started },
    { label: labels.completed, value: a.completed },
    ...(a.quiz ? [{ label: labels.passed, value: a.quiz.passed }] : []),
  ];
}

/** Started and completed per day, for the activity chart. */
export function activitySeries(
  daily: CampaignActivity['daily'],
  names: { started: string; completed: string },
) {
  return [
    {
      name: names.started,
      points: daily.map((d) => ({ label: dayLabel(d.date), value: d.started })),
    },
    {
      name: names.completed,
      points: daily.map((d) => ({ label: dayLabel(d.date), value: d.completed })),
    },
  ];
}

/** The busiest day by participations started, or null when nothing happened in the period. */
export function busiestDay(
  daily: CampaignActivity['daily'],
): { date: string; started: number } | null {
  const best = daily.reduce((a, d) => (d.started > a.started ? d : a), { date: '', started: 0 });
  return best.started > 0 ? { date: best.date, started: best.started } : null;
}

/** A length of time in words keys and a count each: minutes, hours and minutes, or days and hours. */
export function durationParts(minutes: number): {
  unit: 'min' | 'hours' | 'days';
  a: number;
  b: number;
} {
  if (minutes < 60) return { unit: 'min', a: minutes, b: 0 };
  if (minutes < 1440) return { unit: 'hours', a: Math.floor(minutes / 60), b: minutes % 60 };
  return { unit: 'days', a: Math.floor(minutes / 1440), b: Math.floor((minutes % 1440) / 60) };
}

/** Whole minutes between two instants, never less than one. */
export const minutesBetween = (fromIso: string, toIso: string): number =>
  Math.max(1, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
