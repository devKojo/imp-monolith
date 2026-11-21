/**
 * Rule-based risk assessment for awards (ADR-R001 decision 8). Pure and versioned: a set of rules each
 * returns a weight and the evidence (counts, never identities) behind it; the score is their sum, capped at
 * 100. The same facts always give the same answer, and what was decided is stored with the award so it can be
 * explained later. Thresholds are never shown to participants; they see only a generic reason.
 */

/** Bump when a weight or rule changes; stored with every decision. */
export const RULES_VERSION = 1;

/** From this score an award waits for the business to review it. */
export const REVIEW_AT = 30;
/** From this score only the platform may release it (a business can still reject it). */
export const FLAG_AT = 70;

export type RiskCode =
  | 'SHARED_NETWORK'
  | 'SHARED_DEVICE'
  | 'WINNERS_SAME_NETWORK'
  | 'NEW_ACCOUNT'
  | 'PRIOR_REJECTION'
  | 'DESTINATION_REUSE'
  | 'CLAIM_NETWORK_SHARED'
  | 'CLAIM_VELOCITY'
  | 'CLAIM_NETWORK_CHANGED';

export type RiskReason = { code: RiskCode; weight: number; evidence: Record<string, number> };
export type RiskBand = 'ALLOW' | 'REVIEW' | 'FLAG';
export type RiskAssessment = {
  score: number;
  band: RiskBand;
  reasons: RiskReason[];
  version: number;
};

export const bandOf = (score: number): RiskBand =>
  score >= FLAG_AT ? 'FLAG' : score >= REVIEW_AT ? 'REVIEW' : 'ALLOW';

function assess(reasons: RiskReason[]): RiskAssessment {
  const score = Math.min(
    100,
    reasons.reduce((sum, r) => sum + r.weight, 0),
  );
  return { score, band: bandOf(score), reasons, version: RULES_VERSION };
}

/** What is known about a winner when winners are settled. Counts are of other people, never names. */
export type SettleFacts = {
  /** Other people who joined this campaign from the same network. */
  sharedNetwork: number;
  /** Other people who joined from the same network and the same browser. */
  sharedDevice: number;
  /** Other winners of this campaign who joined from the same network. */
  winnersOnNetwork: number;
  accountAgeHours: number;
  /** This person's awards in this business that were rejected or revoked before. */
  priorRejections: number;
};

export const NO_SETTLE_FACTS: SettleFacts = {
  sharedNetwork: 0,
  sharedDevice: 0,
  winnersOnNetwork: 0,
  accountAgeHours: Number.POSITIVE_INFINITY,
  priorRejections: 0,
};

export function assessSettlement(f: SettleFacts): RiskAssessment {
  const reasons: RiskReason[] = [];
  if (f.sharedNetwork >= 1) {
    reasons.push({
      code: 'SHARED_NETWORK',
      weight: f.sharedNetwork >= 3 ? 40 : 20,
      evidence: { others: f.sharedNetwork },
    });
  }
  if (f.sharedDevice >= 1) {
    reasons.push({ code: 'SHARED_DEVICE', weight: 25, evidence: { others: f.sharedDevice } });
  }
  if (f.winnersOnNetwork >= 1) {
    reasons.push({
      code: 'WINNERS_SAME_NETWORK',
      weight: 30,
      evidence: { others: f.winnersOnNetwork },
    });
  }
  if (f.accountAgeHours < 24) {
    reasons.push({
      code: 'NEW_ACCOUNT',
      weight: 15,
      evidence: { hours: Math.floor(Math.max(0, f.accountAgeHours)) },
    });
  }
  if (f.priorRejections >= 1) {
    reasons.push({
      code: 'PRIOR_REJECTION',
      weight: 30,
      evidence: { awards: f.priorRejections },
    });
  }
  return assess(reasons);
}

/** What is known when a winner claims money or an item. */
export type ClaimFacts = {
  /** Other people in this business who gave the same payout destination. */
  destinationUsers: number;
  /** Other people who claimed from this network in the last day. */
  claimNetworkUsers: number;
  /** Claims this person made in the last day before this one. */
  recentClaims: number;
  /** Joined from one network, claiming from another. */
  networkChanged: boolean;
};

export const NO_CLAIM_FACTS: ClaimFacts = {
  destinationUsers: 0,
  claimNetworkUsers: 0,
  recentClaims: 0,
  networkChanged: false,
};

export function assessClaim(f: ClaimFacts): RiskAssessment {
  const reasons: RiskReason[] = [];
  if (f.destinationUsers >= 1) {
    reasons.push({
      code: 'DESTINATION_REUSE',
      weight: 60,
      evidence: { others: f.destinationUsers },
    });
  }
  if (f.claimNetworkUsers >= 2) {
    reasons.push({
      code: 'CLAIM_NETWORK_SHARED',
      weight: 25,
      evidence: { others: f.claimNetworkUsers },
    });
  }
  if (f.recentClaims >= 2) {
    reasons.push({ code: 'CLAIM_VELOCITY', weight: 20, evidence: { claims: f.recentClaims } });
  }
  if (f.networkChanged) reasons.push({ code: 'CLAIM_NETWORK_CHANGED', weight: 10, evidence: {} });
  return assess(reasons);
}

/** A scam report's weight in the platform's review queue; from the reason alone. */
export const REPORT_SEVERITY = {
  ASKED_TO_PAY: 80,
  SUSPICIOUS_CONTACT: 50,
  NOT_RECEIVED: 50,
  OTHER: 20,
} as const;
export type ReportReason = keyof typeof REPORT_SEVERITY;

/** Who may release a held award: a business below the flag line, otherwise the platform. */
export const businessMayRelease = (score: number): boolean => score < FLAG_AT;
