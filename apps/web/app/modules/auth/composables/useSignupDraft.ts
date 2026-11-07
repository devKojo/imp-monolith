export type SignupDraft = {
  name: string;
  email: string;
  password: string;
  /** Set after a successful registration, for the "check your email" page. */
  submittedEmail: string;
  /** A server rejection to show on step 1 (for example a breached password). */
  passwordError: string;
};

/**
 * Carries step 1 (account) to step 2 (business) in memory only. It is never written to browser
 * storage (UI-PUB-03) and, because it is only filled by client-side handlers, never ends up in the
 * server-rendered payload. A reload loses it, which is the intended behaviour for a password.
 */
export const useSignupDraft = () =>
  useState<SignupDraft>('signup:draft', () => ({
    name: '',
    email: '',
    password: '',
    submittedEmail: '',
    passwordError: '',
  }));
