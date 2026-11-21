/** What a platform reviewer sees. Winners are named (the platform decides about people); destinations are not shown. */

export type PrizeKind = 'CASH' | 'POINTS' | 'ITEM';

/** How widely the same signals appear in other businesses: counts only. Read through the platform role. */
export type CrossBusiness = {
  /** Other businesses where the same payout destination was used. */
  destinationBusinesses: number;
  /** Other businesses where someone joined from the same network. */
  networkBusinesses: number;
};

export type ReviewItem = {
  awardId: string;
  status: 'PENDING_REVIEW' | 'HELD';
  riskScore: number;
  riskReasons: string[];
  crossBusiness: CrossBusiness;
  businessName: string;
  campaignTitle: string;
  winnerName: string;
  kind: PrizeKind;
  amountMinor: number | null;
  currency: string | null;
  /** When the award was made (the review has waited since then). */
  createdAt: string;
};

export type ReviewPage = { items: ReviewItem[]; total: number };

export type ReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';

export type ReportItem = {
  id: string;
  awardId: string;
  status: ReportStatus;
  reason: string;
  details: string;
  severity: number;
  reporterName: string;
  businessName: string;
  campaignTitle: string;
  createdAt: string;
  /** Open reports against this business, and the score they add up to (see `scamScore`). */
  businessOpenReports: number;
  businessScamScore: number;
  resolution: string;
};

export type ReportPage = { items: ReportItem[]; total: number };

export type Decision = 'release' | 'reject' | 'revoke';

export type DecisionOutcome =
  { kind: 'done'; status: string } | { kind: 'blocked'; status: string } | { kind: 'missing' };

export type ResolveOutcome =
  { kind: 'done' } | { kind: 'already'; status: string } | { kind: 'missing' };
