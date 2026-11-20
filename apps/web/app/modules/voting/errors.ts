import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed voting call. Codes come from the API's problem envelope. */
export function ballotErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'CAMPAIGN_FULL':
      return 'quiz.error.full';
    case 'ALREADY_VOTED':
      return 'ballot.error.already';
    case 'INVALID_OPTION':
      return 'ballot.error.invalid';
    case 'NETWORK':
      return 'ballot.error.network';
    default:
      return 'ballot.error.generic';
  }
}
