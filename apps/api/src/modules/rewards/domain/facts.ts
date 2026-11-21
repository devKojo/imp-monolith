import type { SettleFacts } from './risk';

/** A join signal as stored: who, from which network, in which browser (hashes only). */
export type JoinSignal = { userId: string; ipHash: string | null; uaHash: string | null };

/**
 * What the winners' join signals say about each of them: how many other people joined from the same network
 * or the same browser, and how many other winners did. `signals` must hold every join signal on the winners'
 * networks (their own and others'). Counts of other people only; nobody is named.
 */
export function settleFactsFrom(input: {
  winners: readonly string[];
  signals: readonly JoinSignal[];
  /** When each winner's account was created. */
  createdAt: ReadonlyMap<string, Date>;
  /** Rejected or revoked awards per winner. */
  priorRejections: ReadonlyMap<string, number>;
  now: Date;
}): Map<string, SettleFacts> {
  const isWinner = new Set(input.winners);
  const out = new Map<string, SettleFacts>();
  for (const userId of input.winners) {
    const mine = input.signals.filter((s) => s.userId === userId && s.ipHash !== null);
    const ips = new Set(mine.map((s) => s.ipHash));
    const devices = new Set(mine.map((s) => `${s.ipHash}|${s.uaHash}`));
    const network = new Set<string>();
    const device = new Set<string>();
    const winners = new Set<string>();
    for (const s of input.signals) {
      if (s.userId === userId || !ips.has(s.ipHash)) continue;
      network.add(s.userId);
      if (isWinner.has(s.userId)) winners.add(s.userId);
      if (s.uaHash !== null && devices.has(`${s.ipHash}|${s.uaHash}`)) device.add(s.userId);
    }
    const created = input.createdAt.get(userId);
    out.set(userId, {
      sharedNetwork: network.size,
      sharedDevice: device.size,
      winnersOnNetwork: winners.size,
      accountAgeHours: created
        ? (input.now.getTime() - created.getTime()) / 3_600_000
        : Number.POSITIVE_INFINITY,
      priorRejections: input.priorRejections.get(userId) ?? 0,
    });
  }
  return out;
}
