// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { maskEmail } from './mask';

describe('maskEmail', () => {
  it('keeps the first letter and the domain only', () => {
    expect(maskEmail('pat.smith@gmail.com')).toBe('p***@gmail.com');
    expect(maskEmail('  Ada@Example.com ')).toBe('A***@Example.com');
  });

  it('hides a one-letter name entirely and tolerates bad input', () => {
    expect(maskEmail('a@b.test')).toBe('***@b.test');
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('')).toBe('');
  });
});
