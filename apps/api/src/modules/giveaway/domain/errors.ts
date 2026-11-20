import { AppError, NotFoundError } from '@/shared/errors';

/** No such giveaway: unknown, not running, another kind, or another business's (indistinguishable). */
export class GiveawayNotFoundError extends NotFoundError {
  constructor() {
    super('Giveaway not found');
  }
}

/** Entering needs a participant account; a business account cannot enter. */
export class ParticipantOnlyError extends AppError {
  constructor() {
    super('Sign in with a participant account to enter this giveaway', 403, 'PARTICIPANT_ONLY');
  }
}
