import type { CampaignParticipation } from '../participants/types';
import type { CampaignResults } from '../voting/types';
import type { DailyActivity, ParticipationKind } from '../participants/types';

/** The groups campaigns are counted in, in the order they are drawn. */
const STATUS_GROUPS = [
  { key: 'live', statuses: ['LIVE'] },
  { key: 'scheduled', statuses: ['SCHEDULED'] },
  { key: 'draft', statuses: ['DRAFT'] },
  { key: 'paused', statuses: ['PAUSED'] },
  // A finished or cancelled campaign is over either way.
  { key: 'ended', statuses: ['COMPLETED', 'CANCELLED'] },
] as const;

export type StatusKey = (typeof STATUS_GROUPS)[number]['key'];

/** How many campaigns are in each group; groups with none are left out so the chart shows only what exists. */
export function statusCounts(
  items: ReadonlyArray<{ status: string }>,
  label: (key: StatusKey) => string,
): Array<{ label: string; value: number }> {
  return STATUS_GROUPS.map((g) => ({
    label: label(g.key),
    value: items.filter((c) => (g.statuses as readonly string[]).includes(c.status)).length,
  })).filter((s) => s.value > 0);
}

/**
 * Started and completed for the campaigns with the most participation, as two series that share their
 * labels. The first `limit` campaigns are kept in the order given (the API sends the busiest first).
 */
export function campaignBars(
  campaigns: readonly CampaignParticipation[],
  names: { started: string; completed: string },
  limit = 6,
) {
  const top = campaigns.slice(0, limit);
  return [
    {
      name: names.started,
      points: top.map((c) => ({ label: c.title, value: c.started })),
    },
    {
      name: names.completed,
      points: top.map((c) => ({ label: c.title, value: c.completed })),
    },
  ];
}

/** The campaign types in the order they are drawn. */
const KIND_ORDER = ['quiz', 'survey', 'poll', 'vote', 'giveaway'] as const;

/**
 * Participation per campaign type across the business, so every type has its share on the dashboard.
 * Types with none are left out; a vote and an entry count as one participation each.
 */
export function participationByType(
  campaigns: ReadonlyArray<Pick<CampaignParticipation, 'kind' | 'started'>>,
  label: (kind: (typeof KIND_ORDER)[number]) => string,
): Array<{ label: string; value: number }> {
  return KIND_ORDER.map((kind) => ({
    label: label(kind),
    value: campaigns.filter((c) => c.kind === kind).reduce((n, c) => n + c.started, 0),
  })).filter((p) => p.value > 0);
}

/**
 * One series for the campaigns of the given types, busiest first: votes for polls and image votes,
 * entries for giveaways. Campaigns with no participation are left out.
 */
export function barsOfKinds(
  campaigns: readonly CampaignParticipation[],
  kinds: readonly string[],
  name: string,
  limit = 6,
) {
  const top = campaigns
    .filter((c) => kinds.includes(c.kind) && c.started > 0)
    .sort((a, b) => b.started - a.started || a.title.localeCompare(b.title))
    .slice(0, limit);
  return top.length === 0
    ? []
    : [{ name, points: top.map((c) => ({ label: c.title, value: c.started })) }];
}

/** Votes per option of one poll or image vote, most votes first, for a bar chart. */
export function standingsBars(results: Pick<CampaignResults, 'options'>, name: string, limit = 8) {
  const top = [...results.options]
    .sort((a, b) => b.votes - a.votes || a.index - b.index)
    .slice(0, limit);
  return [{ name, points: top.map((o) => ({ label: o.label, value: o.votes })) }];
}

/** The option in front, or null while nobody has voted. Ties go to the earlier option. */
export function leadingOption(
  results: Pick<CampaignResults, 'total' | 'options'>,
): { label: string; votes: number } | null {
  if (results.total === 0 || results.options.length === 0) return null;
  const top = results.options.reduce((best, o) => (o.votes > best.votes ? o : best));
  return { label: top.label, votes: top.votes };
}

/**
 * One line per campaign type over the last days, so polls, image votes and giveaways each have their own line
 * beside quizzes and surveys. A type with no participation in the period is left out. `byKind` has one number
 * per day, in the order of `daily`.
 */
export function kindSeries(
  daily: ReadonlyArray<Pick<DailyActivity, 'date'>>,
  byKind: Partial<Record<ParticipationKind, readonly number[]>>,
  label: (kind: ParticipationKind) => string,
  dayName: (isoDate: string) => string,
): Array<{ name: string; points: Array<{ label: string; value: number }> }> {
  return KIND_ORDER.filter((kind) => (byKind[kind] ?? []).some((n) => n > 0)).map((kind) => ({
    name: label(kind),
    points: daily.map((d, i) => ({ label: dayName(d.date), value: byKind[kind]?.[i] ?? 0 })),
  }));
}
