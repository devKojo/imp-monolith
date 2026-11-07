import { domainToASCII } from 'node:url';

/** Trim, lower-case and IDN-normalise (punycode) an email address (R-PAR-01 style). */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return email;
  const domain = domainToASCII(email.slice(at + 1)) || email.slice(at + 1);
  return `${email.slice(0, at)}@${domain}`;
}
