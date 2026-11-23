import { AppError } from '@/shared/errors';
import { toPoolView, type PoolView, type PrizePool } from './pool';

/**
 * The public listing of running campaigns (docs/frontend/discovery-contract.md). Everything here is
 * public content only: no tenant ids, no template fields, no participant data.
 */
export const PUBLIC_TYPES = ['quiz', 'poll', 'survey', 'vote', 'giveaway'] as const;
export type PublicType = (typeof PUBLIC_TYPES)[number];

export type PublicCampaign = {
  id: string;
  /** The page is /c/{slug}. */
  slug: string;
  title: string;
  summary: string;
  businessName: string;
  type: PublicType;
  endsAt: string;
  /** The zone the end time is shown in. Campaigns store UTC instants, so this is "UTC" for now. */
  timeZone: string;
  prize?: { label: string; value: string };
};

/** A row as the repository reads it: enough to build a PublicCampaign, never more. */
export type PublicRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  endAt: Date;
  archetype: string;
  businessName: string;
  prize: { name: string; valueLabel: string } | null;
  /** Every prize tier, in order; only read for one campaign's page, not for the listing. */
  prizes?: PublicPrizeTier[];
  startAt?: Date | null;
  /** A prize pool instead of prize tiers, and how many have joined so far. */
  pool?: PrizePool | null;
  participantCount?: number;
};

export type PublicPrizeTier = {
  name: string;
  valueLabel: string;
  winners: number;
  description: string;
};

/** One campaign's page: the listing entry plus what the page itself shows. Still public content only. */
export type PublicCampaignDetail = PublicCampaign & {
  startsAt: string | null;
  prizes: PublicPrizeTier[];
  /** Set instead of prize tiers when the campaign shares a pool among a limited number of people. */
  pool: (PoolView & { joined: number; spotsLeft: number }) | null;
};

export function toPublicDetail(row: PublicRow): PublicCampaignDetail {
  return {
    ...toPublic(row),
    startsAt: row.startAt ? row.startAt.toISOString() : null,
    prizes: row.prizes ?? [],
    pool: row.pool
      ? {
          ...toPoolView(row.pool),
          joined: row.participantCount ?? 0,
          spotsLeft: Math.max(0, row.pool.maxParticipants - (row.participantCount ?? 0)),
        }
      : null,
  };
}

export const PAGE_SIZE = 60;

/** Template kinds, as the public listing names them. */
const ARCHETYPE_TYPE: Record<string, PublicType> = {
  giveaway: 'giveaway',
  quiz: 'quiz',
  survey: 'survey',
  poll: 'poll',
  vote: 'vote',
};

/** The template kinds that show up under a public type. */
export function archetypesFor(type: PublicType): string[] {
  return Object.entries(ARCHETYPE_TYPE)
    .filter(([, t]) => t === type)
    .map(([a]) => a);
}

export function toPublic(row: PublicRow): PublicCampaign {
  const prizeText = row.prize ? row.prize.valueLabel || row.prize.name : '';
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    businessName: row.businessName,
    type: ARCHETYPE_TYPE[row.archetype] ?? 'giveaway',
    endsAt: row.endAt.toISOString(),
    timeZone: 'UTC',
    ...(row.pool
      ? { prize: { label: 'Prize pool', value: toPoolView(row.pool).label } }
      : row.prize && prizeText
        ? {
            prize: {
              label: row.prize.valueLabel ? row.prize.name || 'Prize' : 'Prize',
              value: prizeText,
            },
          }
        : {}),
  };
}

export type Cursor = { endAt: Date; id: string };

/** Keyset position (R-DAT-11): opaque to clients, so the order can change without breaking them. */
export const encodeCursor = (c: Cursor): string =>
  Buffer.from(JSON.stringify({ e: c.endAt.toISOString(), i: c.id })).toString('base64url');

export class InvalidCursorError extends AppError {
  constructor() {
    super('The cursor is not valid', 400, 'INVALID_CURSOR');
  }
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      e?: unknown;
      i?: unknown;
    };
    const endAt = new Date(String(parsed.e));
    const id = String(parsed.i);
    if (Number.isNaN(endAt.getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('shape');
    return { endAt, id };
  } catch {
    throw new InvalidCursorError();
  }
}
