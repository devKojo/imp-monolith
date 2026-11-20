import { describe, expect, it } from 'vitest';
import { awardsCsv, csvCell } from '../domain/export';
import type { AwardRow } from '../domain/model';

const row = (over: Partial<AwardRow>): AwardRow => ({
  id: 'a',
  userId: 'u',
  name: 'Ama',
  prizeId: null,
  slot: 1,
  rank: 1,
  kind: 'CASH',
  amountMinor: 5000,
  currency: 'GHS',
  source: 'RANKING',
  status: 'CLAIMED',
  claimBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  payoutMethod: 'MOBILE_MONEY',
  payoutHint: '••••4567',
  paidReference: null,
  ...over,
});

describe('csvCell', () => {
  it('neutralises spreadsheet formulas', () => {
    for (const bad of ['=SUM(A1)', '+1', '-2', '@cmd', '\tx']) {
      expect(csvCell(bad).startsWith("'")).toBe(true);
    }
  });
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
  });
});

describe('awardsCsv', () => {
  it('has a header, one line per award and no full destination', () => {
    const csv = awardsCsv([row({}), row({ name: '=HYPERLINK("x")', rank: 2 })]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Place,Winner/);
    expect(lines[1]).toBe('1,Ama,CASH,5000,GHS,CLAIMED,MOBILE_MONEY,••••4567,,');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
