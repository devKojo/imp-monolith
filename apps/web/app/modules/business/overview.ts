import type { CampaignParticipation } from '../participants/types';

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

/** A title cut to fit under a bar, with an ellipsis when it was shortened. */
export const shortLabel = (title: string, max = 14): string =>
  title.length <= max ? title : `${title.slice(0, Math.max(1, max - 1)).trimEnd()}…`;

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
      points: top.map((c) => ({ label: shortLabel(c.title), value: c.started })),
    },
    {
      name: names.completed,
      points: top.map((c) => ({ label: shortLabel(c.title), value: c.completed })),
    },
  ];
}
