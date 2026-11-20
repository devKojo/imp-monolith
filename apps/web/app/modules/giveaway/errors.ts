import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed giveaway call. Codes come from the API's problem envelope. */
export function giveawayErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'CAMPAIGN_FULL':
      return 'quiz.error.full';
    case 'NETWORK':
      return 'giveaway.error.network';
    default:
      return 'giveaway.error.generic';
  }
}
