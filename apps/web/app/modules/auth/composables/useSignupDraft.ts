import type { Portal } from '../types';

export type SignupDraft = {
  /** Set after a successful registration, for the "check your email" page. */
  submittedEmail: string;
  portal: Portal;
};

/**
 * Carries the address (never the password) to the "check your email" page, in memory only. It is
 * never written to browser storage (UI-PUB-03) and is only filled by client-side handlers.
 */
export const useSignupDraft = () =>
  useState<SignupDraft>('signup:draft', () => ({ submittedEmail: '', portal: 'participant' }));
