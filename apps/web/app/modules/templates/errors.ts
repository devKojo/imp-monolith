import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed templates call. Codes come from the API's problem envelope. */
export function templateErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'VERSION_CONFLICT':
      return 'tpl.error.conflict';
    case 'TEMPLATE_PUBLISHED':
      return 'tpl.error.locked';
    case 'PREFLIGHT_FAILED':
      return 'tpl.error.checks';
    case 'TEMPLATE_INVALID':
    case 'VALIDATION_ERROR':
      return 'tpl.error.invalid';
    case 'FORBIDDEN':
      return 'tpl.error.forbidden';
    case 'NETWORK':
      return 'tpl.error.offline';
    default:
      return 'tpl.error.generic';
  }
}
