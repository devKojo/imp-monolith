import { en, type AppTextKey } from './en';

export type TextParams = Record<string, string | number>;

/** Look up app copy and fill `{param}` placeholders. Becomes a thin wrapper over vue-i18n's `t`. */
export function t(key: AppTextKey, params: TextParams = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export type { AppTextKey };
