import { AppError, NotFoundError } from '@/shared/errors';

/** The signed-in role may not manage rewards. */
export class RewardsPermissionError extends AppError {
  constructor() {
    super('Your role cannot manage rewards', 403, 'FORBIDDEN');
  }
}

export class NoActiveBusinessError extends AppError {
  constructor() {
    super('No active business', 403, 'NO_ACTIVE_BUSINESS');
  }
}

/** No such campaign in this business (another business's campaign is indistinguishable). */
export class CampaignNotFoundError extends NotFoundError {
  constructor() {
    super('Campaign not found');
  }
}

export class DrawNotFoundError extends NotFoundError {
  constructor() {
    super('Draw not found');
  }
}

/** The campaign has not ended (or filled up), so winners cannot be settled yet. */
export class CampaignNotEndedError extends AppError {
  constructor() {
    super('Winners can be settled only after the campaign has ended', 409, 'CAMPAIGN_NOT_ENDED');
  }
}

/** Awards for this campaign already exist; settling is once only. */
export class AlreadyAwardedError extends AppError {
  constructor() {
    super('This campaign has already been settled', 409, 'ALREADY_AWARDED');
  }
}

/** A draw must be sealed before the campaign closes, so nobody can pick the rules after seeing entries. */
export class DrawNotSealedError extends AppError {
  constructor() {
    super('The draw was not sealed before the campaign closed', 409, 'DRAW_NOT_SEALED');
  }
}

/** Sealing is only meaningful for a draw, and only while the campaign is still open. */
export class SealNotAllowedError extends AppError {
  constructor(message: string) {
    super(message, 409, 'SEAL_NOT_ALLOWED');
  }
}

export class NoEntrantsError extends AppError {
  constructor() {
    super('Nobody is eligible for a reward in this campaign', 409, 'NO_ENTRANTS');
  }
}

/** The prizes cannot be settled automatically (instant win, mixed methods, or none). */
export class UnsupportedRewardsError extends AppError {
  constructor(message: string) {
    super(message, 422, 'REWARDS_UNSUPPORTED');
  }
}
