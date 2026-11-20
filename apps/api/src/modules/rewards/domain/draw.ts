import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { DrawRules, PublishedDraw, SettleableCampaign } from './model';

/**
 * A reproducible draw. The business never chooses winners; anyone can re-run this from the published
 * facts and get the same people.
 *
 *   seal   the server picks a secret nonce and publishes only `rulesHash = H(rules, H(nonce))`, before the
 *          campaign closes, so the rules and the randomness are fixed before anyone has entered
 *   draw   once it closes, the entrants (each a one-way reference, in a fixed order) are hashed, the nonce is
 *          revealed, and `seed = H(rulesHash, entrantsHash, nonce)` drives a seeded shuffle
 *   verify recompute every hash and re-run the shuffle (`verifyDraw`)
 *
 * Pure rules: no I/O.
 */

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
export const newNonce = (): string => randomBytes(32).toString('hex');

/** The rules a draw is bound to. A launched campaign's prizes cannot change, so this is stable. */
export function rulesOf(c: Pick<SettleableCampaign, 'id' | 'archetype' | 'prizes'>): DrawRules {
  return {
    campaignId: c.id,
    archetype: c.archetype,
    prizes: [...c.prizes]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        position: p.position,
        winners: p.winners,
        rankFrom: p.rankFrom,
        rankTo: p.rankTo,
      })),
  };
}

/** The commitment published at seal time: binds the rules and (without revealing it) the nonce. */
export const rulesHashOf = (rules: DrawRules, nonce: string): string =>
  sha256(`${canonicalJson(rules)}|${sha256(nonce)}`);

/**
 * JSON with object keys in sorted order. The rules are stored as `jsonb`, which does not keep key order, so
 * the hash must not depend on it or a published draw could never be re-verified.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A one-way reference for an entrant, so a draw can be published without naming anyone. */
export const entrantRef = (drawId: string, userId: string): string =>
  sha256(`${drawId}:${userId}`).slice(0, 16);

export const entrantsHashOf = (refs: readonly string[]): string => sha256(refs.join(','));

export const seedOf = (rulesHash: string, entrantsHash: string, nonce: string): string =>
  sha256(['draw-v1', rulesHash, entrantsHash, nonce].join('|'));

/** A deterministic stream of uniform integers from a seed (HMAC-SHA256 in counter mode). */
function stream(seed: string) {
  let counter = 0;
  let buf = Buffer.alloc(0);
  let at = 0;
  const next32 = (): number => {
    if (at + 4 > buf.length) {
      buf = createHmac('sha256', seed).update(String(counter++)).digest();
      at = 0;
    }
    const n = buf.readUInt32BE(at);
    at += 4;
    return n;
  };
  /** A uniform integer in [0, n) without modulo bias (rejection sampling). */
  return (n: number): number => {
    const limit = Math.floor(0x1_0000_0000 / n) * n;
    for (;;) {
      const x = next32();
      if (x < limit) return x % n;
    }
  };
}

/** Fisher-Yates with a seeded stream: the same seed and list always give the same order. */
export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const a = [...items];
  const below = stream(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export type DrawOutcome = {
  /** Entrant references in the fixed (user id) order, and their hash. */
  refs: string[];
  entrantsHash: string;
  seed: string;
  /** User ids in drawn order: the first ones fill the prize slots in order. */
  order: string[];
  /** The same order as references. */
  orderRefs: string[];
};

/** Runs the shuffle over the entrants. Pure: given the same inputs it always returns the same order. */
export function runDraw(input: {
  drawId: string;
  rulesHash: string;
  nonce: string;
  userIds: readonly string[];
}): DrawOutcome {
  const ids = [...new Set(input.userIds)].sort();
  const refs = ids.map((id) => entrantRef(input.drawId, id));
  const entrantsHash = entrantsHashOf(refs);
  const seed = seedOf(input.rulesHash, entrantsHash, input.nonce);
  const idByRef = new Map(refs.map((r, i) => [r, ids[i] as string]));
  const orderRefs = shuffle(refs, seed);
  return {
    refs,
    entrantsHash,
    seed,
    order: orderRefs.map((r) => idByRef.get(r) as string),
    orderRefs,
  };
}

/** Re-runs a published draw from its public facts. True only if every hash and every winner matches. */
export function verifyDraw(p: PublishedDraw): boolean {
  if (rulesHashOf(p.rules, p.nonce) !== p.rulesHash) return false;
  if (entrantsHashOf(p.entrants) !== p.entrantsHash) return false;
  if (seedOf(p.rulesHash, p.entrantsHash, p.nonce) !== p.seed) return false;
  const order = shuffle(p.entrants, p.seed);
  return p.winners.every((w, i) => order[i] === w.ref);
}
