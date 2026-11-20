import type { PrizeKind } from '../rewards/types';

export type CrossBusiness = { destinationBusinesses: number; networkBusinesses: number };

/** An award waiting for review or held, as `GET /platform/reviews` returns it. */
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
  businessOpenReports: number;
  businessScamScore: number;
  resolution: string;
};
export type ReportPage = { items: ReportItem[]; total: number };

export type Decision = 'release' | 'reject' | 'revoke';
