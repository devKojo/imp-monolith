import type { AppTextKey } from '../../i18n';
import type { ApiError } from '../auth/errors';

/** The line shown when settling or paying out a reward fails. */
export function payoutErrorKey(err: ApiError): AppTextKey {
  switch (err.code) {
    case 'FORBIDDEN':
      return 'rewards.biz.error.forbidden';
    case 'AWARD_NOT_PAYABLE':
      return 'rewards.biz.error.notPayable';
    case 'ALREADY_AWARDED':
      return 'rewards.biz.error.alreadySettled';
    case 'CAMPAIGN_NOT_ENDED':
      return 'rewards.biz.error.notEnded';
    case 'DRAW_NOT_SEALED':
      return 'rewards.biz.error.notSealed';
    case 'NO_ENTRANTS':
      return 'rewards.biz.error.noEntrants';
    case 'REWARDS_UNSUPPORTED':
      return 'rewards.biz.error.unsupported';
    case 'NETWORK':
      return 'rewards.biz.error.network';
    default:
      return 'rewards.biz.error.generic';
  }
}

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
