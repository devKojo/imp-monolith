import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { PublicCampaignPage } from '../quiz/types';
import type { AnswerValue, ResponseView, SurveyInfo } from './types';

type Method = 'GET' | 'POST' | 'PUT';

/**
 * Same-origin client for the survey endpoints. Cookies travel automatically (single origin, R-WEB-01);
 * every state-changing call carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown as
 * ApiError, like the other clients.
 */
export function createSurveyApi(fetcher: Fetcher, root = '/api/v1') {
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
    // Visitors: the public page and the facts.
    campaign: (slug: string) => call<PublicCampaignPage>('GET', `/public/campaigns/${slug}`),
    info: (slug: string) => call<SurveyInfo>('GET', `/public/survey/${slug}`),

    // The participant: answer the survey.
    start: (slug: string, csrf: string) =>
      call<ResponseView>('POST', `/survey/${slug}/response`, { csrf }),
    current: (slug: string) => call<ResponseView>('GET', `/survey/${slug}/response`),
    answer: (slug: string, questionId: string, value: AnswerValue, csrf: string) =>
      call<void>('PUT', `/survey/${slug}/response/answers/${questionId}`, { body: value, csrf }),
    submit: (slug: string, csrf: string) =>
      call<ResponseView>('POST', `/survey/${slug}/response/submit`, { csrf }),
  };
}

export type SurveyApi = ReturnType<typeof createSurveyApi>;
