/**
 * Client-side validation for the auth forms. These mirror the server rules (apps/api
 * modules/identity/domain/password-policy.ts) so users get feedback while typing; the server stays
 * authoritative and also checks passwords against known breaches. Keep both in step until the
 * shared contracts package exists.
 */
import { t } from '../../i18n';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = { id: string; label: string; met: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailProblem(value: string): string | undefined {
  const v = value.trim();
  if (!v) return t('validation.email.required');
  if (v.length > 254 || !EMAIL.test(v)) return t('validation.email.invalid');
  return undefined;
}

export function nameProblem(value: string): string | undefined {
  const v = value.trim();
  if (!v) return t('validation.name.required');
  if (v.length > 120) return t('validation.name.tooLong');
  return undefined;
}

export function businessNameProblem(value: string): string | undefined {
  const v = value.trim();
  if (!v) return t('validation.businessName.required');
  if (v.length > 160) return t('validation.businessName.tooLong');
  return undefined;
}

/** Sign-in only needs "something was typed"; the rules apply when a password is created. */
export const signinPasswordProblem = (value: string): string | undefined =>
  value ? undefined : t('validation.password.required');

/** The requirements shown next to the password field, in the order users should read them. */
export function passwordRules(password: string, email: string): PasswordRule[] {
  const local = email.trim().toLowerCase().split('@')[0] ?? '';
  const typed = password.length > 0;
  return [
    {
      id: 'length',
      label: t('validation.password.rule.length', { min: PASSWORD_MIN_LENGTH }),
      met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: 'email-name',
      label: t('validation.password.rule.emailName'),
      met: typed && !(local.length >= 4 && password.toLowerCase().includes(local)),
    },
    {
      id: 'variety',
      label: t('validation.password.rule.variety'),
      met: typed && !/^(.)\1+$/.test(password),
    },
  ];
}

export const passwordProblem = (password: string, email: string): string | undefined => {
  if (password.length > PASSWORD_MAX_LENGTH) return t('validation.password.tooLong');
  return passwordRules(password, email).every((r) => r.met)
    ? undefined
    : t('validation.password.rules');
};

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Drop empty entries so `Object.keys(errors).length` is the number of problems. */
export function compact<K extends string>(errors: FieldErrors<K>): FieldErrors<K> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => !!v)) as FieldErrors<K>;
}

/**
 * Only same-site relative paths are honoured after sign-in, so a crafted `?next=` link cannot send
 * a user to another site (open redirect). Anything else falls back to the dashboard.
 */
export function safeRedirect(next: unknown, fallback = '/app'): string {
  if (typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

export const ROLE_LABELS: Record<string, string> = {
  BUSINESS_OWNER: 'Owner',
  BUSINESS_ADMINISTRATOR: 'Administrator',
  CAMPAIGN_MANAGER: 'Campaign Manager',
  CAMPAIGN_OPERATOR: 'Campaign Operator',
  ANALYST: 'Analyst',
  MODERATOR: 'Moderator',
};
