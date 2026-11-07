/**
 * Display formatting only (UI-PUB-04). It never rejects or drops valid characters; the server
 * performs the real E.164 normalisation (R-PAR-01). Applied on blur, not while typing.
 */
export function formatPhoneForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  const international = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits === '') return trimmed; // nothing we can format: leave exactly as typed
  if (international) {
    // +CCC then 2-3-4 style groups; country-code length varies, so this is a readability aid.
    const [cc, rest] = [digits.slice(0, 3), digits.slice(3)];
    return ['+' + cc, ...group(rest, [2, 3, 4])].filter(Boolean).join(' ');
  }
  return group(digits, [3, 3, 4]).join(' ');
}

function group(digits: string, sizes: number[]): string[] {
  const out: string[] = [];
  let i = 0;
  for (const size of sizes) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out;
}

/** Mask a phone for display: "024 123 4567" -> "024 *** ** 67" (spec 7.4). */
export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return '*'.repeat(digits.length);
  return `${digits.slice(0, 3)} *** ** ${digits.slice(-2)}`;
}

/** Mask an email for display: "kofi@mail.com" -> "k***@mail.com" (spec 7.4). */
export function maskEmail(raw: string): string {
  const at = raw.lastIndexOf('@');
  if (at < 1) return '***';
  return `${raw[0]}${'*'.repeat(Math.max(3, at - 1))}${raw.slice(at)}`;
}
