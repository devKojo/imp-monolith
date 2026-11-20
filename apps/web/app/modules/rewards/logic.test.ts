// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { awardAmount, canClaim, chipStatus, daysLeft, section } from './logic';

describe('awardAmount', () => {
  it('reads money in major units and points as a count', () => {
    expect(awardAmount({ kind: 'CASH', amountMinor: 5000, currency: 'GHS' })).toMatch(/50\.00/);
    expect(awardAmount({ kind: 'POINTS', amountMinor: 1200, currency: null })).toBe('1,200 points');
  });
  it('has no minor units for a currency without them', () => {
    expect(awardAmount({ kind: 'CASH', amountMinor: 5000, currency: 'UGX' })).toMatch(/5,000/);
    expect(awardAmount({ kind: 'CASH', amountMinor: 5000, currency: 'UGX' })).not.toMatch(/\.00/);
  });
  it('is null while the prize is only described in text', () => {
    expect(awardAmount({ kind: 'ITEM', amountMinor: null, currency: null })).toBeNull();
    expect(awardAmount({ kind: 'CASH', amountMinor: null, currency: 'GHS' })).toBeNull();
  });
});

describe('claiming', () => {
  it('is possible only while available', () => {
    expect(canClaim({ status: 'AVAILABLE' })).toBe(true);
    for (const s of ['CLAIMED', 'FULFILLED', 'HELD', 'EXPIRED', 'REVOKED', 'PENDING_REVIEW']) {
      expect(canClaim({ status: s })).toBe(false);
    }
  });
  it('puts what can be claimed above the history', () => {
    expect(section({ status: 'AVAILABLE' })).toBe('available');
    expect(section({ status: 'EXPIRED' })).toBe('history');
  });
  it('shows review and rejection with the shared status words', () => {
    expect(chipStatus('PENDING_REVIEW')).toBe('HELD');
    expect(chipStatus('REJECTED')).toBe('FORFEITED');
    expect(chipStatus('CLAIMED')).toBe('CLAIMED');
  });
});

describe('daysLeft', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  it('rounds up to whole days', () => {
    expect(daysLeft('2026-06-02T11:00:00Z', now)).toBe(1);
    expect(daysLeft('2026-06-15T12:00:00Z', now)).toBe(14);
  });
  it('is null with no deadline or after it', () => {
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft('2026-05-31T00:00:00Z', now)).toBeNull();
  });
});
