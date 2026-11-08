import { AppError } from '@/shared/errors';

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
}
/** Registration with an address that already has an account (the unique email index decides). */
export class EmailTakenError extends AppError {
  constructor() {
    super('An account with this email already exists', 409, 'EMAIL_TAKEN');
  }
}
export class UnauthenticatedError extends AppError {
  constructor() {
    super('Authentication required', 401, 'UNAUTHENTICATED');
  }
}
export class EmailNotVerifiedError extends AppError {
  constructor() {
    super('Email address is not verified', 403, 'EMAIL_NOT_VERIFIED');
  }
}
/** Correct credentials, but the account belongs to the other portal (participant vs business). */
export class WrongPortalError extends AppError {
  constructor(public readonly accountType: 'BUSINESS' | 'PARTICIPANT') {
    super('This account belongs to a different portal', 409, 'WRONG_PORTAL');
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}
export class CsrfError extends AppError {
  constructor(message = 'CSRF validation failed') {
    super(message, 403, 'CSRF_FAILED');
  }
}
export class WeakPasswordError extends AppError {
  constructor(public readonly problems: string[]) {
    super(`Password rejected: ${problems.join('; ')}`, 422, 'WEAK_PASSWORD');
  }
}
export class InvalidTokenError extends AppError {
  constructor() {
    super('Token is invalid or expired', 400, 'INVALID_TOKEN');
  }
}
/** 429/503 responses carry Retry-After (set by the HTTP error handler). */
export class TooManyRequestsError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests', 429, 'TOO_MANY_REQUESTS');
  }
}
export class ServiceBusyError extends AppError {
  constructor(public readonly retryAfterSeconds = 1) {
    super('Service is busy, retry shortly', 503, 'SERVICE_BUSY');
  }
}

/** Google sign-in failed (bad state, bad code, unverified email...). Never says which. */
export class OAuthFailedError extends AppError {
  constructor() {
    super('Google sign-in failed', 401, 'OAUTH_FAILED');
  }
}
