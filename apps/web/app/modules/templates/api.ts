import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type {
  Archetype,
  BlockKind,
  CampaignTemplate,
  TemplateBlock,
  TemplateStatus,
  TemplateSummary,
} from './types';

/** The API's template shape (apps/api modules/templates). The builder calls the fields "blocks". */
type ApiField = {
  id: string;
  kind: BlockKind;
  key: string;
  label: string;
  helper: string;
  required: boolean;
  options: string[];
};
type ApiTemplate = {
  id: string;
  name: string;
  archetype: Archetype;
  status: TemplateStatus;
  version: number;
  updatedAt: string;
  fields: ApiField[];
};

export const fromApi = (t: ApiTemplate): CampaignTemplate => ({
  id: t.id,
  name: t.name,
  archetype: t.archetype,
  status: t.status,
  version: t.version,
  updatedAt: t.updatedAt,
  blocks: t.fields.map((f): TemplateBlock => ({ ...f })),
});

/** What a save sends: the version that was read, and the fields without client-side ids. */
export const toUpdateBody = (t: CampaignTemplate) => ({
  expectedVersion: t.version,
  name: t.name.trim(),
  archetype: t.archetype,
  fields: t.blocks.map(({ kind, key, label, helper, required, options }) => ({
    kind,
    key,
    label,
    helper,
    required,
    options: kind === 'choice' ? options : [],
  })),
});

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Same-origin client for /api/v1/templates. Cookies travel automatically (single origin, R-WEB-01);
 * every state-changing call carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown
 * as ApiError, like the auth client.
 */
export function createTemplatesApi(fetcher: Fetcher, base = '/api/v1/templates') {
  async function call<T>(
    method: Method,
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
    list: async (): Promise<TemplateSummary[]> =>
      (await call<{ items: TemplateSummary[] }>('GET', '')).items,
    get: async (id: string) => fromApi(await call<ApiTemplate>('GET', `/${id}`)),
    create: async (input: { name: string; archetype: Archetype }, csrf: string) =>
      fromApi(await call<ApiTemplate>('POST', '', { body: input, csrf })),
    update: async (t: CampaignTemplate, csrf: string) =>
      fromApi(await call<ApiTemplate>('PUT', `/${t.id}`, { body: toUpdateBody(t), csrf })),
    publish: async (id: string, expectedVersion: number, csrf: string) =>
      fromApi(
        await call<ApiTemplate>('POST', `/${id}/publish`, { body: { expectedVersion }, csrf }),
      ),
    unpublish: async (id: string, expectedVersion: number, csrf: string) =>
      fromApi(
        await call<ApiTemplate>('POST', `/${id}/unpublish`, { body: { expectedVersion }, csrf }),
      ),
    duplicate: async (id: string, csrf: string, name?: string) =>
      fromApi(
        await call<ApiTemplate>('POST', `/${id}/duplicate`, {
          body: name ? { name } : {},
          csrf,
        }),
      ),
    remove: (id: string, csrf: string) => call<void>('DELETE', `/${id}`, { csrf }),
  };
}

export type TemplatesApi = ReturnType<typeof createTemplatesApi>;
