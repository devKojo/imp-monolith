import { describe, expect, it } from 'vitest';
import {
  NO_CLAIM_FACTS,
  NO_SETTLE_FACTS,
  RULES_VERSION,
  assessClaim,
  assessSettlement,
  bandOf,
  businessMayRelease,
} from '../domain/risk';

describe('bandOf', () => {
  it('allows below 30, reviews 30 to 69, flags from 70', () => {
    expect([0, 29, 30, 69, 70, 100].map(bandOf)).toEqual([
      'ALLOW',
      'ALLOW',
      'REVIEW',
      'REVIEW',
      'FLAG',
      'FLAG',
    ]);
  });
});

describe('assessSettlement', () => {
  it('is clean with no facts', () => {
    expect(assessSettlement(NO_SETTLE_FACTS)).toEqual({
      score: 0,
      band: 'ALLOW',
      reasons: [],
      version: RULES_VERSION,
    });
  });
  it('lets a shared network alone through, but not with a shared device', () => {
    expect(assessSettlement({ ...NO_SETTLE_FACTS, sharedNetwork: 1 }).band).toBe('ALLOW');
    const both = assessSettlement({ ...NO_SETTLE_FACTS, sharedNetwork: 1, sharedDevice: 1 });
    expect(both.score).toBe(45);
    expect(both.band).toBe('REVIEW');
  });
  it('weighs a crowd on one network more', () => {
    expect(assessSettlement({ ...NO_SETTLE_FACTS, sharedNetwork: 3 }).score).toBe(40);
  });
  it('holds another winner on the same network and a person rejected before', () => {
    expect(assessSettlement({ ...NO_SETTLE_FACTS, winnersOnNetwork: 1 }).band).toBe('REVIEW');
    expect(assessSettlement({ ...NO_SETTLE_FACTS, priorRejections: 1 }).band).toBe('REVIEW');
  });
  it('treats a new account as a small signal', () => {
    const r = assessSettlement({ ...NO_SETTLE_FACTS, accountAgeHours: 2 });
    expect(r).toMatchObject({ score: 15, band: 'ALLOW' });
    expect(r.reasons[0]).toMatchObject({ code: 'NEW_ACCOUNT', evidence: { hours: 2 } });
  });
  it('caps the score at 100 and flags a pile of signals', () => {
    const r = assessSettlement({
      sharedNetwork: 5,
      sharedDevice: 2,
      winnersOnNetwork: 2,
      accountAgeHours: 1,
      priorRejections: 2,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe('FLAG');
  });
  it('is deterministic and carries counts, never identities', () => {
    const f = { ...NO_SETTLE_FACTS, sharedNetwork: 2, sharedDevice: 1 };
    expect(assessSettlement(f)).toEqual(assessSettlement(f));
    for (const reason of assessSettlement(f).reasons) {
      expect(Object.values(reason.evidence).every((v) => typeof v === 'number')).toBe(true);
    }
  });
});

describe('assessClaim', () => {
  it('is clean with no facts', () => {
    expect(assessClaim(NO_CLAIM_FACTS).score).toBe(0);
  });
  it('holds a destination another person used', () => {
    expect(assessClaim({ ...NO_CLAIM_FACTS, destinationUsers: 1 })).toMatchObject({
      score: 60,
      band: 'REVIEW',
    });
  });
  it('flags a reused destination from a busy network', () => {
    const r = assessClaim({ ...NO_CLAIM_FACTS, destinationUsers: 2, claimNetworkUsers: 3 });
    expect(r.score).toBe(85);
    expect(r.band).toBe('FLAG');
  });
  it('treats a changed network, or many recent claims, as small signals', () => {
    expect(assessClaim({ ...NO_CLAIM_FACTS, networkChanged: true }).score).toBe(10);
    expect(assessClaim({ ...NO_CLAIM_FACTS, recentClaims: 2 }).score).toBe(20);
    // Together they reach the review line.
    expect(assessClaim({ ...NO_CLAIM_FACTS, recentClaims: 2, networkChanged: true }).band).toBe(
      'REVIEW',
    );
  });
});

describe('businessMayRelease', () => {
  it('stops at the flag line', () => {
    expect(businessMayRelease(69)).toBe(true);
    expect(businessMayRelease(70)).toBe(false);
  });
});
