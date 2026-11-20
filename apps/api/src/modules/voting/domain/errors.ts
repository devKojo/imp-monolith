import { AppError, NotFoundError } from '@/shared/errors';

/** No such poll or image vote: unknown, not running, another kind, or another business's (indistinguishable). */
export class BallotNotFoundError extends NotFoundError {
  constructor() {
    super('Vote not found');
  }
}

/** Voting needs a participant account; a business account cannot vote. */
export class ParticipantOnlyError extends AppError {
  constructor() {
    super('Sign in with a participant account to vote', 403, 'PARTICIPANT_ONLY');
  }
}

/** The campaign has nothing to vote for yet. */
export class BallotEmptyError extends AppError {
  constructor() {
    super('There is nothing to vote for yet', 409, 'BALLOT_EMPTY');
  }
}

/** One vote per participant, and it cannot be changed. */
export class AlreadyVotedError extends AppError {
  constructor() {
    super('You have already voted', 409, 'ALREADY_VOTED');
  }
}

/** The chosen option does not exist. */
export class InvalidOptionError extends AppError {
  constructor() {
    super('That option does not exist', 422, 'INVALID_OPTION');
  }
}

/** The signed-in role may not read the results. */
export class ResultsPermissionError extends AppError {
  constructor() {
    super('Your role cannot see results', 403, 'FORBIDDEN');
  }
}

/** The account has no active business. */
export class NoActiveBusinessError extends AppError {
  constructor() {
    super('No active business', 403, 'NO_ACTIVE_BUSINESS');
  }
}
