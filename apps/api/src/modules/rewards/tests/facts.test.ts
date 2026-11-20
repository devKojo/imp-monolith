import { describe, expect, it } from 'vitest';
import { settleFactsFrom } from '../domain/facts';

const NOW = new Date('2026-06-02T12:00:00Z');
const old = new Date('2026-01-01T00:00:00Z');

describe('settleFactsFrom', () => {
  const run = (signals: Array<[string, string | null, string | null]>, winners: string[]) =>
    settleFactsFrom({
      winners,
      signals: signals.map(([userId, ipHash, uaHash]) => ({ userId, ipHash, uaHash })),
      createdAt: new Map(winners.map((w) => [w, old])),
      priorRejections: new Map(),
      now: NOW,
    });

  it('counts other people on the same network and the same browser', () => {
    const facts = run(
      [
        ['a', 'ip1', 'ua1'],
        ['b', 'ip1', 'ua1'],
        ['c', 'ip1', 'ua2'],
        ['d', 'ip2', 'ua1'],
      ],
      ['a'],
    );
    expect(facts.get('a')).toMatchObject({
      sharedNetwork: 2,
      sharedDevice: 1,
      winnersOnNetwork: 0,
    });
  });

  it('sees another winner on the same network from both sides', () => {
    const facts = run(
      [
        ['a', 'ip1', 'ua1'],
        ['b', 'ip1', 'ua2'],
        ['c', 'ip9', 'ua3'],
      ],
      ['a', 'b', 'c'],
    );
    expect(facts.get('a')?.winnersOnNetwork).toBe(1);
    expect(facts.get('b')?.winnersOnNetwork).toBe(1);
    expect(facts.get('c')).toMatchObject({ sharedNetwork: 0, winnersOnNetwork: 0 });
  });

  it('ignores signals without a network, and counts a person once', () => {
    const facts = run(
      [
        ['a', null, null],
        ['b', null, null],
        ['c', 'ip1', 'ua1'],
        ['c', 'ip1', 'ua1'],
        ['a', 'ip1', 'ua1'],
      ],
      ['a'],
    );
    expect(facts.get('a')).toMatchObject({ sharedNetwork: 1, sharedDevice: 1 });
  });

  it('reads account age and earlier rejections', () => {
    const facts = settleFactsFrom({
      winners: ['a', 'b'],
      signals: [],
      createdAt: new Map([['a', new Date('2026-06-02T10:00:00Z')]]),
      priorRejections: new Map([['b', 2]]),
      now: NOW,
    });
    expect(facts.get('a')?.accountAgeHours).toBe(2);
    expect(facts.get('b')?.accountAgeHours).toBe(Number.POSITIVE_INFINITY);
    expect(facts.get('b')?.priorRejections).toBe(2);
  });
});
