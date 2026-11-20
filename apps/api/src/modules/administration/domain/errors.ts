import { AppError, NotFoundError } from '@/shared/errors';

/** The signed-in person is not platform staff. The same answer whether or not the page exists. */
export class NotPlatformStaffError extends AppError {
  constructor() {
    super('This area is for platform staff', 403, 'FORBIDDEN');
  }
}

export class ReviewItemNotFoundError extends NotFoundError {
  constructor() {
    super('Not found');
  }
}

/** The award is not in a state this decision applies to (already decided, or already paid). */
export class DecisionNotAllowedError extends AppError {
  constructor(readonly awardStatus: string) {
    super('This award can no longer be changed that way', 409, 'DECISION_NOT_ALLOWED');
  }
}
