// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  businessNameProblem,
  compact,
  emailProblem,
  nameProblem,
  passwordProblem,
  passwordRules,
  safeRedirect,
  signinPasswordProblem,
} from './validation';

describe('field validation', () => {
  it('accepts normal emails and rejects malformed ones with a next step', () => {
    expect(emailProblem('kofi@company.com')).toBeUndefined();
    expect(emailProblem('  kofi@company.com  ')).toBeUndefined();
    expect(emailProblem('')).toMatch(/Enter your email/);
    expect(emailProblem('kofi')).toMatch(/like name@company.com/);
    expect(emailProblem('a@b')).toMatch(/like name@company.com/);
    expect(emailProblem(`${'a'.repeat(250)}@x.co`)).toMatch(/like name@company.com/);
  });

  it('requires a name and a business name within the server limits', () => {
    expect(nameProblem('Ada')).toBeUndefined();
    expect(nameProblem('   ')).toMatch(/Enter your full name/);
    expect(nameProblem('x'.repeat(121))).toMatch(/120/);
    expect(businessNameProblem('Acme')).toBeUndefined();
    expect(businessNameProblem('')).toMatch(/Enter your business name/);
    expect(businessNameProblem('x'.repeat(161))).toMatch(/160/);
  });

  it('sign-in only requires that a password was typed', () => {
    expect(signinPasswordProblem('')).toMatch(/Enter your password/);
    expect(signinPasswordProblem('x')).toBeUndefined();
  });
});

describe('password rules mirror the server policy (12-128, not the email name, not repeated)', () => {
  const met = (password: string, email = 'ada@example.com') =>
    Object.fromEntries(passwordRules(password, email).map((r) => [r.id, r.met]));

  it('starts with nothing met for an empty password', () => {
    expect(met('')).toEqual({ length: false, 'email-name': false, variety: false });
  });

  it('checks length at 12 and at most 128 characters', () => {
    expect(met('x'.repeat(11) + 'y').length).toBe(true);
    expect(met('abcdefghijk').length).toBe(false);
    expect(met('a1'.repeat(65)).length).toBe(false); // 130 characters
  });

  it('rejects passwords containing the email name when it is at least 4 characters', () => {
    expect(met('my-ada-lovelace-pw1', 'ada.lovelace@b.co')['email-name']).toBe(true);
    expect(met('ada.lovelace-secret', 'ada.lovelace@b.co')['email-name']).toBe(false);
    expect(met('xx-ada-xx-secret-1', 'ada@example.com')['email-name']).toBe(true); // name shorter than 4
  });

  it('rejects a single repeated character', () => {
    expect(met('aaaaaaaaaaaaaaaa').variety).toBe(false);
    expect(met('correct horse battery').variety).toBe(true);
  });

  it('passwordProblem is clear when everything is met and when something is not', () => {
    expect(passwordProblem('correct horse battery', 'ada@example.com')).toBeUndefined();
    expect(passwordProblem('short', 'ada@example.com')).toMatch(/requirements/);
    expect(passwordProblem('x'.repeat(129), 'a@b.co')).toMatch(/128/);
  });

  it('labels each rule in plain language', () => {
    const labels = passwordRules('', '').map((r) => r.label);
    expect(labels[0]).toBe('At least 12 characters');
    expect(labels.every((l) => l.length > 10)).toBe(true);
  });
});

describe('compact', () => {
  it('drops empty entries', () => {
    expect(compact({ a: 'x', b: undefined, c: '' })).toEqual({ a: 'x' });
  });
});

describe('safeRedirect (open-redirect protection)', () => {
  it('allows same-site relative paths', () => {
    expect(safeRedirect('/app')).toBe('/app');
    expect(safeRedirect('/app/campaigns?tab=1#x')).toBe('/app/campaigns?tab=1#x');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'app',
    '',
    '/ok\nLocation: https://evil.example',
    undefined,
    null,
    ['/app'],
    42,
  ])('falls back for %j', (value) => {
    expect(safeRedirect(value)).toBe('/app');
  });

  it('uses a custom fallback', () => {
    expect(safeRedirect('//x', '/home')).toBe('/home');
  });
});
