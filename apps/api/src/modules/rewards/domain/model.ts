import type { PoolKind } from '@/modules/campaigns';
import type { RiskAssessment } from './risk';

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
  /** What the risk rules said about this winner; absent means nothing was found. */
  risk?: RiskAssessment;
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
  /** How and where it will be sent, masked; null until claimed or for points. */
  payoutMethod: string | null;
  payoutHint: string | null;
  /** The business's own payment reference, once marked paid. */
  paidReference: string | null;
  /** 0 to 100 from the risk rules; from 30 the award waits for review. */
  riskScore: number;
  /** Which rules fired (codes only), so a reviewer can see why it was held. */
  riskReasons: string[];
};

export type ReviewDecision = 'release' | 'reject' | 'revoke';
export type ReviewOutcome =
  | { kind: 'done'; status: string }
  | { kind: 'platform' }
  | { kind: 'blocked'; status: string }
  | { kind: 'missing' };

/** Where to send an award: shown to the business only on request, and every view is recorded. */
export type PayoutDestination = {
  awardId: string;
  winnerName: string;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  method: string;
  accountName: string;
  destination: string;
};

/** What the repository holds for a payout before it is decrypted. */
export type PayoutRecord = Omit<PayoutDestination, 'destination'> & { encrypted: string };

export type FulfilOutcome =
  | { kind: 'fulfilled' }
  | { kind: 'already'; reference: string | null }
  | { kind: 'blocked'; status: string }
  | { kind: 'missing' };

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

/** An award as its winner sees it. `status` already reads as expired once the claim deadline has passed. */
export type MyAward = {
  id: string;
  status: string;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  source: Selection;
  rank: number | null;
  prizeName: string | null;
  claimBy: string | null;
  createdAt: string;
  campaign: { id: string; title: string; slug: string | null };
  businessName: string;
  /** True for money and items: the winner must say where to send them. */
  needsDestination: boolean;
  /** Masked tail of where it will be sent, once claimed. */
  claimHint: string | null;
};

/** One step of an award's history, as its winner may see it (no actor, no internal detail). */
export type MyAwardEvent = {
  type: string;
  toStatus: string | null;
  reasonCode: string | null;
  at: string;
};

export type MyAwardDetail = MyAward & { events: MyAwardEvent[] };

/** Points a person holds with one business: the sum of their ledger entries. */
export type WalletBalance = { businessName: string; points: number };

export type MyAwardsPage = { items: MyAward[]; total: number };

/** What the repository knows about an award before it is claimed. */
export type ClaimTarget = {
  tenantId: string;
  campaignId: string;
  kind: PrizeKind;
  amountMinor: number | null;
  status: string;
  claimBy: Date | null;
};

export type ClaimDestination = {
  method: string;
  accountName: string;
  encrypted: string;
  fingerprint: string;
  hint: string;
};

export type ClaimOutcome =
  | { kind: 'claimed'; status: string; hint: string | null }
  | { kind: 'already'; status: string; hint: string | null }
  | { kind: 'expired' }
  | { kind: 'blocked'; status: string }
  | { kind: 'missing' };
