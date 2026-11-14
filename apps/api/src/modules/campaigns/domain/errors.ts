import { AppError, NotFoundError } from '@/shared/errors';
import type { PreflightCheck } from './model';

/** No such campaign in this business (a campaign of another business is indistinguishable). */
export class CampaignNotFoundError extends NotFoundError {
  constructor() {
    super('Campaign not found');
  }
}

/** The signed-in role may not do this to campaigns. */
export class CampaignPermissionError extends AppError {
  constructor() {
    super('Your role cannot do that to campaigns', 403, 'FORBIDDEN');
  }
}

/** The account has no active business, so there are no campaigns to act on. */
export class NoActiveBusinessError extends AppError {
  constructor() {
    super('No active business', 403, 'NO_ACTIVE_BUSINESS');
  }
}

/** Someone else changed the campaign since the caller read it. Nothing was written. */
export class VersionConflictError extends AppError {
  constructor() {
    super('The campaign changed since you opened it', 412, 'VERSION_CONFLICT');
  }
}

/** Only a draft can be edited or deleted; a launched campaign is fixed. */
export class CampaignLockedError extends AppError {
  constructor() {
    super('Only a draft campaign can be changed or deleted', 409, 'CAMPAIGN_LOCKED');
  }
}

/** The action does not fit the campaign's state (for example pausing one that has ended). */
export class CampaignStateError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CAMPAIGN_STATE');
  }
}

/** The campaign does not pass the checks required to launch; `details` names the failed ones. */
export class PreflightFailedError extends AppError {
  constructor(public readonly details: { failed: PreflightCheck['id'][] }) {
    super('The campaign does not pass the launch checks', 422, 'PREFLIGHT_FAILED');
  }
}

/** The request is well formed but breaks a campaign rule (for example the end is before the start). */
export class CampaignInvalidError extends AppError {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, 422, 'CAMPAIGN_INVALID');
  }
}
