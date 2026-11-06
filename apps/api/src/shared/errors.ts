export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = 'INTERNAL_ERROR',
  ) {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}
