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
