import { describe, expect, it } from 'vitest';
import {
  entrantRef,
  entrantsHashOf,
  rulesHashOf,
  rulesOf,
  runDraw,
  seedOf,
  shuffle,
  verifyDraw,
} from '../domain/draw';
import type { PrizeRow, PublishedDraw } from '../domain/model';
import { drawPlan } from '../domain/plan';

const prize = (over: Partial<PrizeRow> = {}): PrizeRow => ({
  id: 'p1',
  position: 1,
  name: 'Grant',
  kind: 'ITEM',
  amountMinor: null,
  currency: null,
  winners: 2,
  rankFrom: null,
  rankTo: null,
  selection: null,
  ...over,
});
const campaign = { id: 'c1', archetype: 'GIVEAWAY' as const, prizes: [prize()] };
const users = Array.from({ length: 50 }, (_, i) => `user-${String(i).padStart(3, '0')}`);

describe('shuffle', () => {
  it('is the same for the same seed, and a permutation of the input', () => {
    const a = shuffle(users, 'seed-1');
    expect(a).toEqual(shuffle(users, 'seed-1'));
    expect([...a].sort()).toEqual(users);
  });
  it('differs for another seed', () => {
    expect(shuffle(users, 'seed-1')).not.toEqual(shuffle(users, 'seed-2'));
  });
  it('is roughly fair: every entrant can come first', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 400; i++) firsts.add(shuffle(['a', 'b', 'c', 'd'], `s${i}`)[0] as string);
    expect(firsts.size).toBe(4);
  });
});

describe('a sealed draw', () => {
  const nonce = 'n'.repeat(64);
  const rules = rulesOf(campaign);
  const rulesHash = rulesHashOf(rules, nonce);

  it('binds the rules and the nonce, without revealing the nonce', () => {
    expect(rulesHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rulesHash).not.toContain(nonce);
    expect(rulesHashOf({ ...rules, campaignId: 'other' }, nonce)).not.toBe(rulesHash);
    expect(rulesHashOf(rules, 'x'.repeat(64))).not.toBe(rulesHash);
  });

  it('does not depend on the key order of the stored rules (jsonb reorders keys)', () => {
    const reordered = JSON.parse(
      JSON.stringify({
        prizes: rules.prizes.map((p) => ({
          winners: p.winners,
          id: p.id,
          position: p.position,
          rankTo: p.rankTo,
          rankFrom: p.rankFrom,
        })),
        archetype: rules.archetype,
        campaignId: rules.campaignId,
      }),
    );
    expect(rulesHashOf(reordered, nonce)).toBe(rulesHash);
  });

  it('does not depend on the order entrants arrive in', () => {
    const a = runDraw({ drawId: 'd1', rulesHash, nonce, userIds: users });
    const b = runDraw({ drawId: 'd1', rulesHash, nonce, userIds: [...users].reverse() });
    expect(b.order).toEqual(a.order);
    expect(b.seed).toBe(a.seed);
  });

  it('changes when the entrants change, so the list cannot be edited afterwards', () => {
    const a = runDraw({ drawId: 'd1', rulesHash, nonce, userIds: users });
    const b = runDraw({ drawId: 'd1', rulesHash, nonce, userIds: users.slice(1) });
    expect(b.entrantsHash).not.toBe(a.entrantsHash);
    expect(b.seed).not.toBe(a.seed);
  });

  function published(): PublishedDraw {
    const out = runDraw({ drawId: 'd1', rulesHash, nonce, userIds: users });
    const awards = drawPlan(campaign.prizes, out.order);
    return {
      drawId: 'd1',
      rules,
      nonce,
      rulesHash,
      entrants: out.refs,
      entrantsHash: out.entrantsHash,
      seed: out.seed,
      winners: awards.map((a, i) => ({
        ref: out.orderRefs[i] as string,
        prizeId: a.prizeId as string,
        slot: a.slot,
      })),
      sealedAt: '2026-01-01T00:00:00.000Z',
      drawnAt: '2026-02-01T00:00:00.000Z',
    };
  }

  it('can be re-run by anyone from the published facts', () => {
    expect(verifyDraw(published())).toBe(true);
  });

  it('is rejected if anything was tampered with', () => {
    const p = published();
    expect(verifyDraw({ ...p, nonce: 'y'.repeat(64) })).toBe(false);
    expect(verifyDraw({ ...p, rules: { ...p.rules, campaignId: 'other' } })).toBe(false);
    expect(verifyDraw({ ...p, entrants: p.entrants.slice(1) })).toBe(false);
    expect(verifyDraw({ ...p, seed: seedOf(p.rulesHash, p.entrantsHash, 'z') })).toBe(false);
    // Swapping a winner for someone who did not win.
    const loser = p.entrants.find((r) => !p.winners.some((w) => w.ref === r)) as string;
    const [first, ...rest] = p.winners;
    expect(
      verifyDraw({
        ...p,
        winners: [{ ...(first as (typeof p.winners)[number]), ref: loser }, ...rest],
      }),
    ).toBe(false);
  });

  it('names nobody: references are one-way and tied to the draw', () => {
    const ref = entrantRef('d1', 'user-000');
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(ref).not.toContain('user');
    expect(entrantRef('d2', 'user-000')).not.toBe(ref);
    expect(entrantsHashOf([ref])).toMatch(/^[0-9a-f]{64}$/);
  });
});
