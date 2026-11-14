import { AppError, NotFoundError } from '@/shared/errors';

/** No such quiz campaign: unknown, not running, not a quiz, or another business's (indistinguishable). */
export class QuizNotFoundError extends NotFoundError {
  constructor() {
    super('Quiz not found');
  }
}

/** The signed-in business role may not do this to a quiz. */
export class QuizPermissionError extends AppError {
  constructor() {
    super('Your role cannot do that to quizzes', 403, 'FORBIDDEN');
  }
}

/** The account has no active business. */
export class NoActiveBusinessError extends AppError {
  constructor() {
    super('No active business', 403, 'NO_ACTIVE_BUSINESS');
  }
}

/** Taking a quiz needs a participant account; a business account cannot enter. */
export class ParticipantOnlyError extends AppError {
  constructor() {
    super('Sign in with a participant account to take this quiz', 403, 'PARTICIPANT_ONLY');
  }
}

/** The questions of a launched campaign are fixed. */
export class QuizLockedError extends AppError {
  constructor() {
    super('Only a draft campaign can have its questions changed', 409, 'CAMPAIGN_LOCKED');
  }
}

/** The campaign does not use a quiz template. */
export class NotAQuizError extends AppError {
  constructor() {
    super('This campaign does not use a quiz template', 409, 'NOT_A_QUIZ');
  }
}

/** The quiz has no questions yet. */
export class QuizEmptyError extends AppError {
  constructor() {
    super('This quiz has no questions yet', 409, 'QUIZ_EMPTY');
  }
}

/** The questions are not valid (for example no correct answer marked). */
export class QuizInvalidError extends AppError {
  constructor(
    message: string,
    /** Which question (from 0) the problem is in. */
    public readonly details: { index: number },
  ) {
    super(message, 422, 'QUIZ_INVALID');
  }
}

/** The participant has not started this quiz. */
export class NoAttemptError extends AppError {
  constructor() {
    super('You have not started this quiz', 404, 'NO_ATTEMPT');
  }
}

/** The attempt is over (submitted or out of time), so answers can no longer change. */
export class AttemptClosedError extends AppError {
  constructor() {
    super('This attempt is finished', 409, 'ATTEMPT_CLOSED');
  }
}

/** The answer does not match a question or one of its options. */
export class InvalidAnswerError extends AppError {
  constructor() {
    super('That answer does not belong to this question', 422, 'INVALID_ANSWER');
  }
}
