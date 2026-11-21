export type PrizeKind = 'CASH' | 'POINTS' | 'ITEM';
export type PayoutMethod = 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'DELIVERY';

/** One reward a participant has won, as `GET /my-rewards` returns it. */
export type MyAward = {
  id: string;
  /** Already reads as EXPIRED once the claim deadline has passed. */
  status: string;
  kind: PrizeKind;
  /** Whole minor units for money, points for points; null while the prize is only described in text. */
  amountMinor: number | null;
  currency: string | null;
  source: 'RANKING' | 'DRAW' | 'POOL' | 'INSTANT' | 'COMPLETION';
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

export type MyAwardEvent = {
  type: string;
  toStatus: string | null;
  reasonCode: string | null;
  at: string;
};

export type MyAwardDetail = MyAward & { events: MyAwardEvent[] };
export type MyAwardsPage = { items: MyAward[]; total: number };
export type WalletBalance = { businessName: string; points: number };

export type ClaimInput = {
  method?: PayoutMethod;
  destination?: string;
  accountName?: string;
  password?: string;
};
export type ClaimResult = {
  awardId: string;
  status: string;
  claimHint: string | null;
  alreadyClaimed: boolean;
};

/** One award as the business sees it: `GET /rewards/campaigns/:id/awards`. */
export type BusinessAward = {
  id: string;
  userId: string;
  name: string;
  prizeId: string | null;
  slot: number;
  rank: number | null;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  source: string;
  status: string;
  claimBy: string | null;
  createdAt: string;
  /** How and where it will be sent, masked; null until claimed, and for points. */
  payoutMethod: PayoutMethod | null;
  payoutHint: string | null;
  /** The business's own payment reference, once marked paid. */
  paidReference: string | null;
  /** 0 to 100 from the risk rules; from 30 the award waits for review, from 70 only the platform may release it. */
  riskScore: number;
  /** Which rules fired (codes), so a reviewer can see why it was held. */
  riskReasons: string[];
};

/** Where to send one claimed award. Every view of it is recorded against the person who asked. */
export type PayoutDestination = {
  awardId: string;
  winnerName: string;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  method: PayoutMethod;
  accountName: string;
  destination: string;
};

export type ReviewDecision = 'release' | 'reject' | 'revoke';
export type RejectReason = 'NOT_ELIGIBLE' | 'SUSPECTED_ABUSE' | 'OTHER';
export type ReportReason = 'ASKED_TO_PAY' | 'SUSPICIOUS_CONTACT' | 'NOT_RECEIVED' | 'OTHER';
export type ReportInput = { reason: ReportReason; details?: string };

export type FulfilResult = { status: 'FULFILLED'; reference: string | null; alreadyPaid: boolean };
export type SettleResult = { campaignId: string; selection: string; awarded: number };
