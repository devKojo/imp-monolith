/** Error from the API, normalised from its problem envelope `{ error: { code, message, issues? } }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: Array<{ path: Array<string | number>; message: string }> = [],
    /** Seconds from a Retry-After header (429 and 503). */
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

type FetchLikeError = {
  response?: { status?: number; headers?: { get(name: string): string | null }; _data?: unknown };
  statusCode?: number;
  message?: string;
};

/** Turn whatever the fetch layer threw into an ApiError (network failures become status 0). */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = (err ?? {}) as FetchLikeError;
  const status = e.response?.status ?? e.statusCode ?? 0;
  const body = e.response?._data as
    { error?: { code?: string; message?: string; issues?: ApiError['issues'] } } | undefined;
  const retry = Number(e.response?.headers?.get('retry-after'));
  return new ApiError(
    status,
    body?.error?.code ?? (status === 0 ? 'NETWORK' : 'UNKNOWN'),
    body?.error?.message ?? e.message ?? 'Request failed',
    body?.error?.issues ?? [],
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}

/** How a failed auth call should be shown. Maps API codes to the section 11 system states. */
export type AuthFailure =
  | { kind: 'invalid-credentials' }
  | { kind: 'email-not-verified' }
  | { kind: 'wrong-portal' }
  | { kind: 'email-taken' }
  | { kind: 'rate-limited'; retryAfter: number }
  | { kind: 'busy'; retryAfter: number }
  | { kind: 'weak-password'; message: string }
  | { kind: 'validation'; fields: Record<string, string> }
  | { kind: 'csrf' }
  | { kind: 'unauthenticated' }
  | { kind: 'offline' }
  | { kind: 'generic' };

export function classifyAuthError(err: ApiError): AuthFailure {
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return { kind: 'invalid-credentials' };
    case 'WRONG_PORTAL':
      return { kind: 'wrong-portal' };
    case 'EMAIL_TAKEN':
      return { kind: 'email-taken' };
    case 'EMAIL_NOT_VERIFIED':
      return { kind: 'email-not-verified' };
    case 'TOO_MANY_REQUESTS':
      return { kind: 'rate-limited', retryAfter: err.retryAfter ?? 60 };
    case 'SERVICE_BUSY':
      return { kind: 'busy', retryAfter: err.retryAfter ?? 1 };
    case 'WEAK_PASSWORD':
      return { kind: 'weak-password', message: err.message };
    case 'VALIDATION_ERROR': {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = String(issue.path[0] ?? 'form');
        fields[key] ??= issue.message;
      }
      return { kind: 'validation', fields };
    }
    case 'CSRF_FAILED':
      return { kind: 'csrf' };
    case 'UNAUTHENTICATED':
      return { kind: 'unauthenticated' };
    case 'NETWORK':
      return { kind: 'offline' };
    default:
      return err.status === 429
        ? { kind: 'rate-limited', retryAfter: err.retryAfter ?? 60 }
        : { kind: 'generic' };
  }
}
