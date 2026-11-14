import { AppError, NotFoundError } from '@/shared/errors';

/** No such quiz campaign: unknown, not running, not a quiz, or another business's (indistinguishable). */
export class QuizNotFoundError extends NotFoundError {
  constructor() {
    super('Quiz not found');
  }
}

/** Taking a quiz needs a participant account; a business account cannot enter. */
export class ParticipantOnlyError extends AppError {
  constructor() {
    super('Sign in with a participant account to take this quiz', 403, 'PARTICIPANT_ONLY');
  }
}

/** The quiz has no questions yet. */
export class QuizEmptyError extends AppError {
  constructor() {
    super('This quiz has no questions yet', 409, 'QUIZ_EMPTY');
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
