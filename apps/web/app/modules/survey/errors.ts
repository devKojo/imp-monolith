import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed survey call. Codes come from the API's problem envelope. */
export function surveyErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'RESPONSE_CLOSED':
      return 'survey.error.closed';
    case 'ANSWERS_REQUIRED':
      return 'survey.error.required';
    case 'NETWORK':
      return 'survey.error.save';
    default:
      return 'survey.error.generic';
  }
}
