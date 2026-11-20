import type { PoolKind } from '@/modules/campaigns';

export type Actor = { userId: string; tenantId: string; role: string };

export type PrizeKind = 'CASH' | 'POINTS' | 'ITEM';
export type Selection = 'RANKING' | 'DRAW' | 'POOL' | 'INSTANT' | 'COMPLETION';
export type Archetype = 'GIVEAWAY' | 'QUIZ' | 'SURVEY' | 'INSTANT' | 'POLL' | 'VOTE';

export type PrizeRow = {
  id: string;
  position: number;
  name: string;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  winners: number;
  rankFrom: number | null;
  rankTo: number | null;
  selection: Selection | null;
};

export type PoolSpec = {
  kind: PoolKind;
  amount: number;
  currency: string | null;
  maxParticipants: number;
};

/** A campaign as the award engine needs it. */
export type SettleableCampaign = {
  id: string;
  title: string;
  status: string;
  endAt: Date | null;
  archetype: Archetype;
  prizes: PrizeRow[];
  pool: PoolSpec | null;
};

/** A person who took part. `score` is a quiz score; `at` is when they finished or took part. */
export type Entrant = { userId: string; score: number | null; at: Date };

export type PlannedAward = {
  prizeId: string | null;
  userId: string;
  slot: number;
  rank: number | null;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  source: Selection;
};

export type DrawRules = {
  campaignId: string;
  archetype: Archetype;
  prizes: Array<{
    id: string;
    position: number;
    winners: number;
    rankFrom: number | null;
    rankTo: number | null;
  }>;
};

/** A stored draw. The nonce is secret until the draw has been made. */
export type DrawRow = {
  id: string;
  rulesHash: string;
  nonce: string;
  sealedAt: Date;
  drawnAt: Date | null;
};

/** What a business sees about a draw: the commitment, never the nonce before the draw. */
export type DrawView = {
  id: string;
  rulesHash: string;
  sealedAt: string;
  drawnAt: string | null;
};

export type AwardRow = {
  id: string;
  userId: string;
  name: string;
  prizeId: string | null;
  slot: number;
  rank: number | null;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  source: Selection;
  status: string;
  claimBy: string | null;
  createdAt: string;
};

export type AwardResult = {
  campaignId: string;
  selection: Selection;
  awarded: number;
  draw: DrawView | null;
};

/** Everything needed to re-run a draw and get the same winners. Published once the draw is made. */
export type PublishedDraw = {
  drawId: string;
  rules: DrawRules;
  nonce: string;
  rulesHash: string;
  entrants: string[];
  entrantsHash: string;
  seed: string;
  winners: Array<{ ref: string; prizeId: string; slot: number }>;
  sealedAt: string;
  drawnAt: string;
};

/** What a draw stores when it is made. */
export type DrawRecord = {
  rules: DrawRules;
  entrantsHash: string;
  entrants: string[];
  seed: string;
  winners: PublishedDraw['winners'];
  drawnAt: Date;
};
