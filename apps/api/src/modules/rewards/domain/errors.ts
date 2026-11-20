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

/** Only a claimed cash or item award can be sent or marked paid. */
export class AwardNotPayableError extends AppError {
  constructor(readonly awardStatus: string) {
    super('This award is not waiting to be paid', 409, 'AWARD_NOT_PAYABLE');
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

/** Only a participant account has awards to claim. */
export class ParticipantOnlyError extends AppError {
  constructor() {
    super('Only a participant account can claim rewards', 403, 'PARTICIPANT_ONLY');
  }
}

/** No such award for this person (someone else's award is indistinguishable). */
export class AwardNotFoundError extends NotFoundError {
  constructor() {
    super('Reward not found');
  }
}

/** Money and items are only released to a verified address. */
export class ClaimEmailNotVerifiedError extends AppError {
  constructor() {
    super('Verify your email address before claiming this reward', 403, 'EMAIL_NOT_VERIFIED');
  }
}

/** What the person gave is not enough to claim; `message` says what to fix. */
export class ClaimInvalidError extends AppError {
  constructor(message: string) {
    super(message, 422, 'CLAIM_INVALID');
  }
}

export class AwardExpiredError extends AppError {
  constructor() {
    super('The time to claim this reward has passed', 409, 'AWARD_EXPIRED');
  }
}

/** The award is on hold, rejected or withdrawn, so it cannot be claimed now. */
export class AwardNotClaimableError extends AppError {
  constructor(public readonly awardStatus: string) {
    super('This reward cannot be claimed right now', 409, 'AWARD_NOT_CLAIMABLE');
  }
}
