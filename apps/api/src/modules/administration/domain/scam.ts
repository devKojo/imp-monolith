/**
 * How worried to be about a business from the scam reports against it. The reason sets the base (asked to
 * pay a fee is the worst); each further person who reported adds to it, because several winners saying the
 * same thing is stronger than one. Capped at 100. Only open reports count, and one person's repeated reports
 * count once. Orders the platform's queue; it never acts by itself.
 */
export function scamScore(
  reports: ReadonlyArray<{ severity: number; reporterId: string }>,
): number {
  if (reports.length === 0) return 0;
  const worst = Math.max(...reports.map((r) => r.severity));
  const reporters = new Set(reports.map((r) => r.reporterId)).size;
  return Math.min(100, worst + 10 * (reporters - 1));
}
