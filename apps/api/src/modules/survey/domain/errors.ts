import { AppError, NotFoundError } from '@/shared/errors';

/** No such survey campaign: unknown, not running, not a survey, or another business's (indistinguishable). */
export class SurveyNotFoundError extends NotFoundError {
  constructor() {
    super('Survey not found');
  }
}

/** Taking a survey needs a participant account; a business account cannot enter. */
export class ParticipantOnlyError extends AppError {
  constructor() {
    super('Sign in with a participant account to take this survey', 403, 'PARTICIPANT_ONLY');
  }
}

/** The survey has no questions yet. */
export class SurveyEmptyError extends AppError {
  constructor() {
    super('This survey has no questions yet', 409, 'SURVEY_EMPTY');
  }
}

/** The participant has not started this survey. */
export class NoResponseError extends AppError {
  constructor() {
    super('You have not started this survey', 404, 'NO_RESPONSE');
  }
}

/** The response was already submitted, so answers can no longer change. */
export class ResponseClosedError extends AppError {
  constructor() {
    super('This response is already submitted', 409, 'RESPONSE_CLOSED');
  }
}

/** The answer does not match the question. */
export class InvalidAnswerError extends AppError {
  constructor() {
    super('That answer does not belong to this question', 422, 'INVALID_ANSWER');
  }
}

/** Required questions are still unanswered. */
export class RequiredAnswersError extends AppError {
  constructor(public readonly missing: string[]) {
    super('Answer the required questions before submitting', 422, 'ANSWERS_REQUIRED');
  }
}
