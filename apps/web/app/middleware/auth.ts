import { HOME, SIGNIN } from '../modules/auth/constants';
import { useAuth } from '../modules/auth/composables/useAuth';
import type { Portal } from '../modules/auth/types';

/**
 * Guards the dashboard. It runs in the browser only: /app/** is a client-rendered SPA, so private
 * data never passes through the SSR tier (R-WEB-02). The server stays the authority: every API call
 * is checked again, and a 401 sends the user back to sign in.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const portal = (to.meta.portal as Portal | undefined) ?? 'business';
  const signin = SIGNIN[portal];
  const auth = useAuth();
  try {
    const session = await auth.ensure();
    if (!session) return navigateTo({ path: signin, query: { next: to.fullPath } });
    // A signed-in account only uses its own portal; send it home instead of showing a 403.
    if (HOME[session.user.accountType] !== (portal === 'participant' ? '/me' : '/app')) {
      return navigateTo(HOME[session.user.accountType]);
    }
  } catch {
    // The API is unreachable: show sign-in, which explains connection problems, instead of a blank page.
    return navigateTo({ path: signin, query: { next: to.fullPath } });
  }
});
