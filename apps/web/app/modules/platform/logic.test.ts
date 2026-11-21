// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decisionProblem, seenElsewhere, severityOf } from './logic';

describe('severityOf', () => {
  it('bands a score like the API does', () => {
    expect([0, 29, 30, 69, 70, 100].map(severityOf)).toEqual([
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
    ]);
  });
});

describe('seenElsewhere', () => {
  it('is true when either signal appears in another business', () => {
    expect(seenElsewhere({ destinationBusinesses: 0, networkBusinesses: 0 })).toBe(false);
    expect(seenElsewhere({ destinationBusinesses: 1, networkBusinesses: 0 })).toBe(true);
    expect(seenElsewhere({ destinationBusinesses: 0, networkBusinesses: 2 })).toBe(true);
  });
});

describe('decisionProblem', () => {
  it('names what to tell the reviewer', () => {
    expect(decisionProblem({ code: 'PASSWORD_CONFIRMATION_FAILED', status: 403 })).toBe('password');
    expect(decisionProblem({ code: 'DECISION_NOT_ALLOWED', status: 409 })).toBe('notAllowed');
    expect(decisionProblem({ code: 'FORBIDDEN', status: 403 })).toBe('forbidden');
    expect(decisionProblem({ code: 'NETWORK' })).toBe('network');
    expect(decisionProblem({ status: 404 })).toBe('notFound');
    expect(decisionProblem({ status: 500 })).toBe('generic');
  });
});
