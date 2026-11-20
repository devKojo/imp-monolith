import type { AwardRow } from './model';

/**
 * One CSV cell. A value that a spreadsheet would run as a formula (it starts with =, +, - or @, or a tab or
 * return) is prefixed with an apostrophe so a winner's name cannot execute anything on the business's
 * computer; quotes are doubled and the cell is quoted when it needs to be.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  'Place',
  'Winner',
  'Prize type',
  'Amount (minor units)',
  'Currency',
  'Status',
  'Payout method',
  'Sent to',
  'Payment reference',
  'Claim by',
];

/** The awards of a campaign as CSV text. Destinations stay masked: the full one is shown only on request. */
export function awardsCsv(rows: readonly AwardRow[]): string {
  const lines = rows.map((r) =>
    [
      r.rank,
      r.name,
      r.kind,
      r.amountMinor,
      r.currency,
      r.status,
      r.payoutMethod,
      r.payoutHint,
      r.paidReference,
      r.claimBy,
    ]
      .map(csvCell)
      .join(','),
  );
  return [HEADER.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}
