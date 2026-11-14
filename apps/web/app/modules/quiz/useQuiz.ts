import type { Fetcher } from '../auth/api';
import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import { createQuizApi } from './api';
import type { QuizDraft } from './types';

/**
 * The quiz endpoints with the session's CSRF token. Client-side only. A 401 means the session ended, so
 * the person is sent to sign in (and back here afterwards) instead of seeing a broken page. `portal`
 * says which sign-in: participants take quizzes, business users write them.
 */
export function useQuiz(portal: 'participant' | 'business' = 'participant') {
  const auth = useAuth();
  const api = createQuizApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
  const csrf = () => auth.session.value?.csrfToken ?? '';

  async function run<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 401 && portal === 'participant') {
        auth.session.value = null;
        await navigateTo({ path: SIGNIN.participant, query: { next: useRoute().fullPath } });
      } else if (err.status === 401) {
        auth.session.value = null;
        await navigateTo(SIGNIN.business);
      }
      throw err;
    }
  }

  return {
    definition: (campaignId: string) => run(() => api.definition(campaignId)),
    saveDefinition: (campaignId: string, quiz: QuizDraft) =>
      run(() => api.saveDefinition(campaignId, quiz, csrf())),
    // Public reads: no sign-in needed, so a 401 is not expected and is not redirected.
    campaign: (slug: string) => api.campaign(slug),
    info: (slug: string) => api.info(slug),
    start: (slug: string) => run(() => api.start(slug, csrf())),
    current: (slug: string) => run(() => api.current(slug)),
    answer: (slug: string, questionId: string, choiceIndex: number) =>
      run(() => api.answer(slug, questionId, choiceIndex, csrf())),
    submit: (slug: string) => run(() => api.submit(slug, csrf())),
  };
}
