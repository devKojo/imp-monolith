import { describe, expect, it } from 'vitest';
import { scamScore } from '../domain/scam';

describe('scamScore', () => {
  it('is zero with no reports', () => {
    expect(scamScore([])).toBe(0);
  });
  it('starts from the worst reason', () => {
    expect(
      scamScore([
        { severity: 50, reporterId: 'a' },
        { severity: 80, reporterId: 'a' },
      ]),
    ).toBe(80);
  });
  it('adds ten for each further person, and counts one person once', () => {
    expect(
      scamScore([
        { severity: 50, reporterId: 'a' },
        { severity: 50, reporterId: 'b' },
      ]),
    ).toBe(60);
    expect(
      scamScore([
        { severity: 50, reporterId: 'a' },
        { severity: 50, reporterId: 'a' },
        { severity: 50, reporterId: 'a' },
      ]),
    ).toBe(50);
  });
  it('caps at 100', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ severity: 80, reporterId: String(i) }));
    expect(scamScore(many)).toBe(100);
  });
});
