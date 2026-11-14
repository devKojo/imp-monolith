import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed campaigns call. Codes come from the API's problem envelope. */
export function campaignErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'VERSION_CONFLICT':
      return 'cmp.error.conflict';
    case 'CAMPAIGN_LOCKED':
      return 'cmp.error.locked';
    case 'CAMPAIGN_STATE':
      return 'cmp.error.state';
    case 'PREFLIGHT_FAILED':
      return 'cmp.error.checks';
    case 'CAMPAIGN_INVALID':
    case 'VALIDATION_ERROR':
      return 'cmp.error.invalid';
    case 'FORBIDDEN':
      return 'cmp.error.forbidden';
    case 'NETWORK':
      return 'cmp.error.offline';
    default:
      return 'cmp.error.generic';
  }
}
