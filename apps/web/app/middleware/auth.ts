import { useAuth } from '../modules/auth/composables/useAuth';

/**
 * Guards the dashboard. It runs in the browser only: /app/** is a client-rendered SPA, so private
 * data never passes through the SSR tier (R-WEB-02). The server stays the authority: every API call
 * is checked again, and a 401 sends the user back to sign in.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const auth = useAuth();
  try {
    const session = await auth.ensure();
    if (!session) return navigateTo({ path: '/signin', query: { next: to.fullPath } });
  } catch {
    // The API is unreachable: show sign-in, which explains connection problems, instead of a blank page.
    return navigateTo({ path: '/signin', query: { next: to.fullPath } });
  }
});
