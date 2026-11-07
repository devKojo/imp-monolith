import { createAuthApi, type AuthApi, type Fetcher } from '../api';
import { toApiError } from '../errors';
import type { Portal, RegisterInput, RegisterParticipantInput, SessionInfo } from '../types';

/** The API client wired to $fetch. Client-side only: auth pages never call the API during SSR. */
export function useAuthApi(): AuthApi {
  return createAuthApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
}

/**
 * Session state for the dashboard and the auth pages. State lives in useState (per request on the
 * server, per app on the client), never in a module-level variable (ADR-F009). It holds the
 * session summary and the CSRF token only; the session cookie itself is HttpOnly and never visible
 * to JavaScript.
 */
export function useAuth() {
  const api = useAuthApi();
  const session = useState<SessionInfo | null>('auth:session', () => null);
  const checked = useState<boolean>('auth:checked', () => false);

  /** Ask the server who we are. 401 means signed out; anything else is rethrown for the UI. */
  async function refresh(): Promise<SessionInfo | null> {
    try {
      session.value = await api.session();
    } catch (e) {
      const err = toApiError(e);
      if (err.status !== 401) throw err;
      session.value = null;
    }
    checked.value = true;
    return session.value;
  }

  const ensure = async () => (checked.value ? session.value : refresh());

  async function login(
    email: string,
    password: string,
    portal: Portal,
  ): Promise<SessionInfo | null> {
    await api.login(email, password, portal);
    return refresh();
  }

  async function logout(): Promise<void> {
    const csrf = session.value?.csrfToken;
    try {
      if (csrf) await api.logout(csrf);
    } catch (e) {
      // Already signed out (401) is the outcome we wanted; surface anything else.
      if (toApiError(e).status !== 401) throw e;
    } finally {
      session.value = null;
      checked.value = true;
    }
  }

  async function switchTenant(membershipId: string): Promise<SessionInfo | null> {
    const csrf = session.value?.csrfToken;
    if (!csrf) throw toApiError({ statusCode: 401, response: { status: 401 } });
    await api.switchTenant(membershipId, csrf);
    return refresh();
  }

  const register = (input: RegisterInput) => api.register(input);
  const registerParticipant = (input: RegisterParticipantInput) => api.registerParticipant(input);
  const verifyEmail = (token: string) => api.verifyEmail(token);

  return {
    session,
    checked,
    refresh,
    ensure,
    login,
    logout,
    switchTenant,
    register,
    registerParticipant,
    verifyEmail,
  };
}
