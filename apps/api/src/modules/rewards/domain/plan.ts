import { poolShare } from '@/modules/campaigns';
import type {
  Archetype,
  Entrant,
  PlannedAward,
  PoolSpec,
  PrizeRow,
  Selection,
  SettleableCampaign,
} from './model';

/** Turning a campaign's prizes and its entrants into awards. Pure rules: no I/O. */

export type Slot = { prize: PrizeRow; slot: number; rank: number };

const countOf = (p: PrizeRow): number =>
  p.rankFrom !== null && p.rankTo !== null ? p.rankTo - p.rankFrom + 1 : p.winners;

/**
 * Every winning place of every prize, best first. A prize with a placing range ("2nd to 5th") takes
 * exactly those ranks; the others take the next ranks in turn, so "1st" then "2nd" then "3rd to 5th" works
 * from the winner counts alone.
 */
export function expandSlots(prizes: readonly PrizeRow[]): Slot[] {
  const slots: Slot[] = [];
  let next = 1;
  for (const prize of [...prizes].sort((a, b) => a.position - b.position)) {
    const count = countOf(prize);
    const first = prize.rankFrom ?? next;
    for (let i = 0; i < count; i++) slots.push({ prize, slot: i + 1, rank: first + i });
    next = Math.max(next, first + count);
  }
  return slots.sort((a, b) => a.rank - b.rank || a.prize.position - b.prize.position);
}

const awardFor = (
  slot: Slot,
  userId: string,
  source: Selection,
  ranked: boolean,
): PlannedAward => ({
  prizeId: slot.prize.id,
  userId,
  slot: slot.slot,
  rank: ranked ? slot.rank : null,
  kind: slot.prize.kind,
  amountMinor: slot.prize.amountMinor,
  currency: slot.prize.currency,
  source,
});

/** Highest score first; a tie goes to whoever finished earlier, then to the lower user id (never random). */
export function rankEntrants(entrants: readonly Entrant[]): Entrant[] {
  return [...entrants].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      a.at.getTime() - b.at.getTime() ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
}

/** The best-ranked people take the places in order; places beyond the number of entrants stay empty. */
export function rankingPlan(
  prizes: readonly PrizeRow[],
  entrants: readonly Entrant[],
): PlannedAward[] {
  const slots = expandSlots(prizes);
  return rankEntrants(entrants)
    .slice(0, slots.length)
    .map((e, i) => awardFor(slots[i] as Slot, e.userId, 'RANKING', true));
}

/** `order` is the drawn order of user ids: the first one takes the first place, and so on. */
export function drawPlan(prizes: readonly PrizeRow[], order: readonly string[]): PlannedAward[] {
  const slots = expandSlots(prizes);
  return order.slice(0, slots.length).map((id, i) => awardFor(slots[i] as Slot, id, 'DRAW', false));
}

/** Every participant gets the same share of a prize pool. */
export function poolPlan(pool: PoolSpec, userIds: readonly string[]): PlannedAward[] {
  const { share } = poolShare(pool);
  return [...new Set(userIds)].sort().map((userId) => ({
    prizeId: null,
    userId,
    slot: 1,
    rank: null,
    kind: pool.kind === 'POINTS' ? ('POINTS' as const) : ('CASH' as const),
    amountMinor: share,
    currency: pool.currency,
    source: 'POOL' as const,
  }));
}

const DEFAULT_SELECTION: Record<Archetype, Selection | null> = {
  QUIZ: 'RANKING',
  GIVEAWAY: 'DRAW',
  SURVEY: 'DRAW',
  POLL: 'DRAW',
  VOTE: 'DRAW',
  INSTANT: null,
};

export type SelectionResult =
  { ok: true; selection: Selection } | { ok: false; reason: 'UNSUPPORTED' | 'MIXED' | 'NO_PRIZES' };

/** How this campaign picks winners: a pool shares equally; otherwise the prizes agree on one method. */
export function selectionOf(
  c: Pick<SettleableCampaign, 'archetype' | 'prizes' | 'pool'>,
): SelectionResult {
  if (c.pool) return { ok: true, selection: 'POOL' };
  if (c.prizes.length === 0) return { ok: false, reason: 'NO_PRIZES' };
  const wanted = new Set(c.prizes.map((p) => p.selection ?? DEFAULT_SELECTION[c.archetype]));
  if (wanted.size > 1) return { ok: false, reason: 'MIXED' };
  const [only] = [...wanted];
  // Instant win and completion rewards are not settled by a single run at the end.
  if (!only || only === 'INSTANT' || only === 'COMPLETION')
    return { ok: false, reason: 'UNSUPPORTED' };
  return { ok: true, selection: only };
}
