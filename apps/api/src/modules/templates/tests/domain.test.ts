import { describe, expect, it } from 'vitest';
import { canManageTemplates, canReadTemplates } from '../domain/permissions';
import { duplicateKeys, failedChecks, normalizeFields, preflight } from '../domain/rules';
import { field } from './repository.contract';

describe('normalizeFields', () => {
  it('trims text and keeps answers only on a choice question', () => {
    const [a, b] = normalizeFields([
      field({ key: ' email ', label: '  Email  ', helper: ' hint ', options: ['x'] }),
      field({ kind: 'choice', key: 'q', label: 'Pick', options: [' A ', 'B'] }),
    ]);
    expect(a).toMatchObject({ key: 'email', label: 'Email', helper: 'hint', options: [] });
    expect(b!.options).toEqual(['A', 'B']);
  });
});

describe('duplicateKeys', () => {
  it('names each repeated key once', () => {
    expect(
      duplicateKeys([
        field(),
        field(),
        field({ key: 'a' }),
        field({ key: 'a' }),
        field({ key: 'a' }),
      ]),
    ).toEqual(['email', 'a']);
    expect(duplicateKeys([field(), field({ key: 'other' })])).toEqual([]);
  });
});

describe('preflight', () => {
  const consent = field({ kind: 'consent', key: 'consent', label: 'I agree' });
  const passes = (fields: ReturnType<typeof field>[]) =>
    Object.fromEntries(preflight(fields).map((c) => [c.id, c.pass]));

  it('fails an empty template on every check', () => {
    expect(passes([])).toEqual({ fields: false, identity: false, consent: false, labels: false });
  });

  it('passes with a verifiable identity field and a required consent', () => {
    expect(failedChecks([field(), consent])).toEqual([]);
    expect(failedChecks([field({ kind: 'phone', key: 'phone' }), consent])).toEqual([]);
  });

  it('does not count a name as identity, or an optional consent', () => {
    expect(passes([field({ kind: 'full_name', key: 'n' }), consent]).identity).toBe(false);
    expect(passes([field(), { ...consent, required: false }]).consent).toBe(false);
  });

  it('needs every label filled and two answers on a choice question', () => {
    expect(passes([field({ label: '   ' }), consent]).labels).toBe(false);
    const choice = (options: string[]) =>
      field({ kind: 'choice', key: 'q', label: 'Pick', options });
    expect(passes([field(), consent, choice(['A', ''])]).labels).toBe(false);
    expect(passes([field(), consent, choice(['A', 'B'])]).labels).toBe(true);
  });
});

describe('permissions', () => {
  it('lets every business role read, and only campaign runners change', () => {
    for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']) {
      expect(canReadTemplates(role)).toBe(true);
      expect(canManageTemplates(role)).toBe(true);
    }
    for (const role of ['CAMPAIGN_OPERATOR', 'ANALYST', 'MODERATOR']) {
      expect(canReadTemplates(role)).toBe(true);
      expect(canManageTemplates(role)).toBe(false);
    }
    expect(canReadTemplates('PARTICIPANT')).toBe(false);
    expect(canManageTemplates('')).toBe(false);
  });
});
