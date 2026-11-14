import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { AttemptView, PublicCampaignPage, QuizInfo } from './types';

type Method = 'GET' | 'POST' | 'PUT';

/**
 * Same-origin client for the quiz endpoints. Cookies travel automatically (single origin, R-WEB-01);
 * every state-changing call carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown
 * as ApiError, like the other clients.
 */
export function createQuizApi(fetcher: Fetcher, root = '/api/v1') {
  async function call<T>(
    method: Method,
    path: string,
    opts: { body?: unknown; csrf?: string } = {},
  ): Promise<T> {
    try {
      return await fetcher<T>(`${root}${path}`, {
        method,
        body: opts.body,
        headers: opts.csrf ? { 'X-CSRF-Token': opts.csrf } : undefined,
      });
    } catch (err) {
      throw toApiError(err);
    }
  }

  return {
    // Visitors: the public page and the rules.
    campaign: (slug: string) => call<PublicCampaignPage>('GET', `/public/campaigns/${slug}`),
    info: (slug: string) => call<QuizInfo>('GET', `/public/quiz/${slug}`),

    // The participant: take the quiz.
    start: (slug: string, csrf: string) =>
      call<AttemptView>('POST', `/quiz/${slug}/attempt`, { csrf }),
    current: (slug: string) => call<AttemptView>('GET', `/quiz/${slug}/attempt`),
    answer: (slug: string, questionId: string, choiceIndex: number, csrf: string) =>
      call<void>('PUT', `/quiz/${slug}/attempt/answers/${questionId}`, {
        body: { choiceIndex },
        csrf,
      }),
    submit: (slug: string, csrf: string) =>
      call<AttemptView>('POST', `/quiz/${slug}/attempt/submit`, { csrf }),
  };
}

export type QuizApi = ReturnType<typeof createQuizApi>;
