import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown for a failed quiz call. Codes come from the API's problem envelope. */
export function quizErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'ATTEMPT_CLOSED':
      return 'quiz.error.closed';
    case 'NETWORK':
      return 'quiz.error.save';
    default:
      return 'quiz.error.generic';
  }
}
