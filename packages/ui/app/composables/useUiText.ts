import { en, type UiTextKey } from '../i18n/en';

export type TextParams = Record<string, string | number>;

/** Look up a catalogue string and fill `{param}` placeholders. Swap for vue-i18n's `t` later. */
export function uiText(key: UiTextKey, params: TextParams = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export const useUiText = () => ({ t: uiText });
