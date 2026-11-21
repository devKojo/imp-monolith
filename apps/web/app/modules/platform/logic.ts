import { FLAG_AT, REVIEW_AT } from '../rewards/businessLogic';
import type { CrossBusiness } from './types';

export type Severity = 'low' | 'medium' | 'high';

/** A scam score or risk score as a level, for the badge colour. Mirrors the API's bands. */
export const severityOf = (score: number): Severity =>
  score >= FLAG_AT ? 'high' : score >= REVIEW_AT ? 'medium' : 'low';

/** Whether the same signals showed up in other businesses (worth a closer look). */
export const seenElsewhere = (c: CrossBusiness): boolean =>
  c.destinationBusinesses > 0 || c.networkBusinesses > 0;

/** What went wrong with a decision, as a line key. */
export type DecisionProblem =
  'password' | 'notAllowed' | 'notFound' | 'forbidden' | 'network' | 'generic';
export function decisionProblem(err: { code?: string; status?: number }): DecisionProblem {
  switch (err.code) {
    case 'PASSWORD_CONFIRMATION_FAILED':
      return 'password';
    case 'DECISION_NOT_ALLOWED':
      return 'notAllowed';
    case 'NOT_FOUND':
      return 'notFound';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'NETWORK':
      return 'network';
    default:
      return err.status === 404 ? 'notFound' : 'generic';
  }
}
