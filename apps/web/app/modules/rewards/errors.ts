import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed claim. Codes come from the API's problem envelope. */
export function claimErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'PASSWORD_CONFIRMATION_FAILED':
      return 'rewards.error.password';
    case 'EMAIL_NOT_VERIFIED':
      return 'rewards.error.verify';
    case 'AWARD_EXPIRED':
      return 'rewards.error.expired';
    case 'AWARD_NOT_CLAIMABLE':
      return 'rewards.error.notClaimable';
    case 'RATE_LIMITED':
      return 'rewards.error.rateLimited';
    case 'NETWORK':
      return 'rewards.error.network';
    default:
      return 'rewards.error.generic';
  }
}
