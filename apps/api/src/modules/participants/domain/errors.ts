import { AppError, NotFoundError } from '@/shared/errors';

/** The signed-in role may not see participants. */
export class ParticipantsPermissionError extends AppError {
  constructor() {
    super('Your role cannot see participants', 403, 'FORBIDDEN');
  }
}

/** No such campaign in this business (another business's campaign is indistinguishable). */
export class CampaignNotFoundError extends NotFoundError {
  constructor() {
    super('Campaign not found');
  }
}

/** The account has no active business, so there are no participants to show. */
export class NoActiveBusinessError extends AppError {
  constructor() {
    super('No active business', 403, 'NO_ACTIVE_BUSINESS');
  }
}
