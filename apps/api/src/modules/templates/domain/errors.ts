import { AppError, NotFoundError } from '@/shared/errors';
import type { PreflightCheck } from './model';

/** No such template in this business (a template of another business is indistinguishable). */
export class TemplateNotFoundError extends NotFoundError {
  constructor() {
    super('Template not found');
  }
}

/** The signed-in role may not do this to templates. */
export class TemplatePermissionError extends AppError {
  constructor() {
    super('Your role cannot change templates', 403, 'FORBIDDEN');
  }
}

/** The account has no active business, so there are no templates to act on. */
export class NoActiveBusinessError extends AppError {
  constructor() {
    super('No active business', 403, 'NO_ACTIVE_BUSINESS');
  }
}

/** Someone else changed the template since the caller read it. Nothing was written. */
export class VersionConflictError extends AppError {
  constructor() {
    super('The template changed since you opened it', 412, 'VERSION_CONFLICT');
  }
}

/** A published template is read-only until it is unpublished. */
export class TemplateLockedError extends AppError {
  constructor() {
    super(
      'A published template cannot be changed or deleted. Unpublish it first.',
      409,
      'TEMPLATE_PUBLISHED',
    );
  }
}

/** Unpublish or publish asked for a state the template is already in. */
export class TemplateStateError extends AppError {
  constructor(message: string) {
    super(message, 409, 'TEMPLATE_STATE');
  }
}

/** The template does not pass the checks required to publish; `details` names the failed ones. */
export class PreflightFailedError extends AppError {
  constructor(public readonly details: { failed: PreflightCheck['id'][] }) {
    super('The template does not pass the publishing checks', 422, 'PREFLIGHT_FAILED');
  }
}

/** The request is well formed but breaks a template rule (for example repeated field names). */
export class TemplateRuleError extends AppError {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, 422, 'TEMPLATE_INVALID');
  }
}
