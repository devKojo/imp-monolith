import type {
  CampaignStatus,
  PreflightCheck,
  PrizeInput,
  StoredCampaign,
  TemplateRef,
} from './model';

/** Pure rules for campaigns: no I/O, no clock of their own, fully unit-tested. */

/** Templates of these kinds give something away, so the campaign must say what. */
const PRIZE_ARCHETYPES = new Set<string>(['giveaway', 'instant']);

/**
 * The status people should see. The stored status is what was last written; the schedule moves a
 * campaign on its own: a scheduled campaign becomes live at its start, and anything not closed by a
 * person completes at its end. Computing this on read means no background job has to keep it true.
 */
export function effectiveStatus(
  stored: CampaignStatus,
  startAt: Date | null,
  endAt: Date | null,
  now: Date,
): CampaignStatus {
  const running = stored === 'SCHEDULED' || stored === 'LIVE' || stored === 'PAUSED';
  if (running && endAt && now >= endAt) return 'COMPLETED';
  if (stored === 'SCHEDULED' && startAt && now >= startAt) return 'LIVE';
  return stored;
}

export const withEffectiveStatus = <T extends Pick<StoredCampaign, 'status' | 'startAt' | 'endAt'>>(
  row: T,
  now: Date,
): T => ({
  ...row,
  status: effectiveStatus(
    row.status,
    row.startAt ? new Date(row.startAt) : null,
    row.endAt ? new Date(row.endAt) : null,
    now,
  ),
});

/** Launching (or resuming) before the start time waits for it; otherwise the campaign is live now. */
export const runningStatusFor = (startAt: Date | null, now: Date): 'SCHEDULED' | 'LIVE' =>
  startAt && startAt > now ? 'SCHEDULED' : 'LIVE';

/** `Win a Prize!` becomes `win-a-prize`: lowercase ASCII words joined by single hyphens. */
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return base || 'campaign';
}

/** Trim what the client sent so equal input is stored the same way. */
export const normalizePrizes = (prizes: readonly PrizeInput[]): PrizeInput[] =>
  prizes.map((p) => ({
    name: p.name.trim(),
    valueLabel: p.valueLabel.trim(),
    winners: p.winners,
    description: p.description.trim(),
  }));

export type PreflightInput = {
  title: string;
  template: TemplateRef | null;
  startAt: Date | null;
  endAt: Date | null;
  prizes: readonly PrizeInput[];
};

/**
 * The checks a campaign must pass to launch. The server is the authority: the web app shows the same
 * list to guide people, but only this result decides.
 */
export function preflight(input: PreflightInput, now: Date): PreflightCheck[] {
  const prizesComplete = input.prizes.every((p) => p.name.trim() !== '' && p.winners >= 1);
  const needsPrizes = input.template !== null && PRIZE_ARCHETYPES.has(input.template.archetype);
  return [
    { id: 'title', pass: input.title.trim() !== '' },
    { id: 'template', pass: input.template !== null && input.template.status === 'PUBLISHED' },
    {
      id: 'schedule',
      pass:
        input.endAt !== null &&
        input.endAt > now &&
        (input.startAt === null || input.startAt < input.endAt),
    },
    { id: 'prizes', pass: prizesComplete && (!needsPrizes || input.prizes.length > 0) },
  ];
}

export const failedChecks = (input: PreflightInput, now: Date): PreflightCheck[] =>
  preflight(input, now).filter((c) => !c.pass);
