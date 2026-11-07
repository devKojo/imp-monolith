import { toApiError } from './errors';
import type {
  LoginResult,
  Portal,
  RegisterInput,
  RegisterParticipantInput,
  SessionInfo,
} from './types';

/** The part of $fetch the client needs; injected so the client is testable without Nuxt. */
export type Fetcher = <T>(
  url: string,
  opts: { method: string; body?: unknown; headers?: Record<string, string> },
) => Promise<T>;

/**
 * Same-origin client for /api/v1/auth. Cookies travel automatically (single origin, R-WEB-01);
 * authenticated state-changing calls carry the session-bound X-CSRF-Token (R-IAM-02). Every
 * failure is thrown as an ApiError.
 */
export function createAuthApi(fetcher: Fetcher, base = '/api/v1/auth') {
  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: unknown; csrf?: string } = {},
  ): Promise<T> {
    try {
      return await fetcher<T>(`${base}${path}`, {
        method,
        body: opts.body,
        headers: opts.csrf ? { 'X-CSRF-Token': opts.csrf } : undefined,
      });
    } catch (err) {
      throw toApiError(err);
    }
  }

  return {
    register: (input: RegisterInput) =>
      call<{ status: string }>('POST', '/register', { body: input }),
    registerParticipant: (input: RegisterParticipantInput) =>
      call<{ status: string }>('POST', '/register-participant', { body: input }),
    resendVerification: (email: string) =>
      call<{ status: string }>('POST', '/resend-verification', { body: { email } }),
    forgotPassword: (email: string) =>
      call<{ status: string }>('POST', '/forgot-password', { body: { email } }),
    resetPassword: (token: string, password: string) =>
      call<{ accountType: 'BUSINESS' | 'PARTICIPANT' }>('POST', '/reset-password', {
        body: { token, password },
      }),
    providers: () => call<{ google: boolean }>('GET', '/providers'),
    sendVerification: (csrf: string) =>
      call<{ status: 'sent' | 'already_verified' }>('POST', '/send-verification', { csrf }),
    verifyEmail: (token: string) => call<void>('POST', '/verify-email', { body: { token } }),
    login: (email: string, password: string, portal: Portal) =>
      call<LoginResult>('POST', '/login', { body: { email, password, portal } }),
    session: () => call<SessionInfo>('GET', '/session'),
    logout: (csrf: string) => call<void>('POST', '/logout', { csrf }),
    switchTenant: (membershipId: string, csrf: string) =>
      call<{ csrfToken: string; activeMembershipId: string }>('POST', '/switch-tenant', {
        body: { membershipId },
        csrf,
      }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
