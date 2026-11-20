import { describe, expect, it } from 'vitest';
import { currentSignals, hashSignal } from './request-signals';

describe('hashSignal', () => {
  it('is a stable keyed hash that does not contain the value', () => {
    const a = hashSignal('k'.repeat(32), '203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(hashSignal('k'.repeat(32), '203.0.113.7'));
    expect(a).not.toContain('203');
  });
  it('differs by key and by value', () => {
    expect(hashSignal('a'.repeat(32), 'x')).not.toBe(hashSignal('b'.repeat(32), 'x'));
    expect(hashSignal('a'.repeat(32), 'x')).not.toBe(hashSignal('a'.repeat(32), 'y'));
  });
  it('is null for a missing or blank value', () => {
    expect(hashSignal('k', undefined)).toBeNull();
    expect(hashSignal('k', '  ')).toBeNull();
  });
});

describe('currentSignals', () => {
  it('is empty outside a request', () => {
    expect(currentSignals()).toEqual({ ipHash: null, uaHash: null });
  });
});
