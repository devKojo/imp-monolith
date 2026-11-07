// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createAuthApi, type Fetcher } from './api';
import { ApiError, classifyAuthError, toApiError } from './errors';

type Call = {
  url: string;
  opts: { method: string; body?: unknown; headers?: Record<string, string> };
};

function fakeFetcher(result: unknown | ((c: Call) => unknown)) {
  const calls: Call[] = [];
  const fetcher: Fetcher = async <T>(url: string, opts: Call['opts']) => {
    calls.push({ url, opts });
    const r =
      typeof result === 'function' ? (result as (c: Call) => unknown)({ url, opts }) : result;
    if (r instanceof Error) throw r;
    return r as T;
  };
  return { fetcher, calls };
}

const fetchError = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  Object.assign(new Error('fetch failed'), {
    response: {
      status,
      _data: data,
      headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    },
  });

describe('createAuthApi', () => {
  it('calls the documented endpoints with the right methods and bodies', async () => {
    const { fetcher, calls } = fakeFetcher({});
    const api = createAuthApi(fetcher);
    await api.login('a@b.co', 'pw');
    await api.verifyEmail('tok');
    await api.session();
    await api.register({
      name: 'Ada',
      email: 'a@b.co',
      password: 'pw',
      businessName: 'Acme',
      agreement: { accepted: true, version: '1.0' },
    });
    expect(calls.map((c) => `${c.opts.method} ${c.url}`)).toEqual([
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/verify-email',
      'GET /api/v1/auth/session',
      'POST /api/v1/auth/register',
    ]);
    expect(calls[0]!.opts.body).toEqual({ email: 'a@b.co', password: 'pw' });
    expect(calls[3]!.opts.body).toMatchObject({ agreement: { accepted: true, version: '1.0' } });
  });

  it('sends the session-bound CSRF token on logout and switch-tenant, and not on public calls', async () => {
    const { fetcher, calls } = fakeFetcher({});
    const api = createAuthApi(fetcher);
    await api.logout('csrf-1');
    await api.switchTenant('m-1', 'csrf-2');
    await api.login('a@b.co', 'pw');
    expect(calls[0]!.opts.headers).toEqual({ 'X-CSRF-Token': 'csrf-1' });
    expect(calls[1]!.opts.headers).toEqual({ 'X-CSRF-Token': 'csrf-2' });
    expect(calls[1]!.opts.body).toEqual({ membershipId: 'm-1' });
    expect(calls[2]!.opts.headers).toBeUndefined();
  });

  it('throws ApiError with the code, message, issues and Retry-After from the problem envelope', async () => {
    const { fetcher } = fakeFetcher(
      fetchError(
        429,
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' } },
        { 'retry-after': '45' },
      ),
    );
    const err = await createAuthApi(fetcher)
      .login('a@b.co', 'x')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS', retryAfter: 45 });
  });

  it('treats a network failure as status 0 / NETWORK', async () => {
    const { fetcher } = fakeFetcher(new TypeError('Failed to fetch'));
    const err = await createAuthApi(fetcher)
      .session()
      .catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK' });
  });
});

describe('classifyAuthError', () => {
  const err = (status: number, code: string, extra: Partial<ApiError> = {}) =>
    Object.assign(new ApiError(status, code, 'msg'), extra);

  it('maps API codes to the section 11 presentations', () => {
    expect(classifyAuthError(err(401, 'INVALID_CREDENTIALS'))).toEqual({
      kind: 'invalid-credentials',
    });
    expect(classifyAuthError(err(403, 'EMAIL_NOT_VERIFIED'))).toEqual({
      kind: 'email-not-verified',
    });
    expect(classifyAuthError(err(429, 'TOO_MANY_REQUESTS', { retryAfter: 30 }))).toEqual({
      kind: 'rate-limited',
      retryAfter: 30,
    });
    expect(classifyAuthError(err(503, 'SERVICE_BUSY', { retryAfter: 2 }))).toEqual({
      kind: 'busy',
      retryAfter: 2,
    });
    expect(classifyAuthError(err(0, 'NETWORK'))).toEqual({ kind: 'offline' });
    expect(classifyAuthError(err(403, 'CSRF_FAILED'))).toEqual({ kind: 'csrf' });
    expect(classifyAuthError(err(401, 'UNAUTHENTICATED'))).toEqual({ kind: 'unauthenticated' });
    expect(classifyAuthError(err(500, 'INTERNAL_ERROR'))).toEqual({ kind: 'generic' });
  });

  it('defaults a missing Retry-After and handles a bare 429', () => {
    expect(classifyAuthError(err(429, 'TOO_MANY_REQUESTS'))).toEqual({
      kind: 'rate-limited',
      retryAfter: 60,
    });
    expect(classifyAuthError(err(429, 'WHATEVER'))).toEqual({
      kind: 'rate-limited',
      retryAfter: 60,
    });
  });

  it('keeps the first message per field for validation errors', () => {
    const e = err(400, 'VALIDATION_ERROR', {
      issues: [
        { path: ['businessName'], message: 'Required' },
        { path: ['businessName'], message: 'Too short' },
        { path: ['agreement', 'accepted'], message: 'Invalid literal' },
      ],
    });
    expect(classifyAuthError(e)).toEqual({
      kind: 'validation',
      fields: { businessName: 'Required', agreement: 'Invalid literal' },
    });
  });

  it('carries the server message for weak passwords', () => {
    expect(classifyAuthError(err(422, 'WEAK_PASSWORD'))).toEqual({
      kind: 'weak-password',
      message: 'msg',
    });
  });
});

describe('toApiError', () => {
  it('passes ApiError through and tolerates odd inputs', () => {
    const e = new ApiError(400, 'X', 'm');
    expect(toApiError(e)).toBe(e);
    expect(toApiError(undefined)).toMatchObject({ status: 0, code: 'NETWORK' });
    expect(toApiError({ statusCode: 500 })).toMatchObject({ status: 500, code: 'UNKNOWN' });
  });

  it('ignores a non-numeric Retry-After', () => {
    const err = toApiError(
      fetchError(503, { error: { code: 'SERVICE_BUSY' } }, { 'retry-after': 'soon' }),
    );
    expect(err.retryAfter).toBeUndefined();
  });
});
