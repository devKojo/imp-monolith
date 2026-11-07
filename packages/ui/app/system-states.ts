import type { IconName } from './icons';
import type { UiTextKey } from './i18n/en';

/**
 * The system-state matrix (UI spec section 11, acceptance UXA-006). One entry per state: how it is
 * presented and its icon. Copy lives in the string catalogue under `state.<kind>.title|body|action`.
 * A test asserts every kind has its strings, so a new state cannot ship half-designed.
 *
 *  page    full-width empty-state treatment in place of content
 *  inline  message in place of the affected section; navigation unchanged
 *  banner  persistent message above content
 */
export const systemStates = {
  unauthenticated: { presentation: 'inline', icon: 'lock', tone: 'info', http: '401' },
  forbidden: { presentation: 'inline', icon: 'lock', tone: 'info', http: '403' },
  notFound: { presentation: 'page', icon: 'search', tone: 'info', http: '404' },
  conflict: { presentation: 'banner', icon: 'alert-triangle', tone: 'warning', http: '409' },
  generic: { presentation: 'inline', icon: 'alert-circle', tone: 'error', http: '428/5xx' },
  rateLimited: { presentation: 'banner', icon: 'clock', tone: 'warning', http: '429' },
  busy: { presentation: 'banner', icon: 'refresh', tone: 'info', http: '503' },
  waitingRoom: { presentation: 'page', icon: 'clock', tone: 'info', http: 'admission' },
  notStarted: { presentation: 'page', icon: 'clock', tone: 'info', http: '-' },
  ended: { presentation: 'page', icon: 'check-circle', tone: 'info', http: '-' },
  paused: { presentation: 'page', icon: 'pause', tone: 'info', http: '-' },
  exhausted: { presentation: 'banner', icon: 'box', tone: 'info', http: '-' },
  unavailable: { presentation: 'page', icon: 'shield', tone: 'info', http: 'kill switch' },
  offline: { presentation: 'banner', icon: 'wifi-off', tone: 'system', http: 'network' },
  uploadRejected: { presentation: 'inline', icon: 'alert-circle', tone: 'error', http: 'upload' },
  drawDone: { presentation: 'banner', icon: 'info', tone: 'info', http: '-' },
  entitlement: { presentation: 'banner', icon: 'alert-triangle', tone: 'warning', http: 'quota' },
  empty: { presentation: 'page', icon: 'box', tone: 'info', http: '-' },
  suspended: {
    presentation: 'banner',
    icon: 'pause-shield',
    tone: 'warning',
    http: 'tenant status',
  },
} as const satisfies Record<
  string,
  {
    presentation: 'page' | 'inline' | 'banner';
    icon: IconName;
    tone: 'info' | 'warning' | 'error' | 'system';
    http: string;
  }
>;

export type SystemStateKind = keyof typeof systemStates;
export const systemStateKinds = Object.keys(systemStates) as SystemStateKind[];

export const stateKey = (kind: SystemStateKind, part: 'title' | 'body' | 'action'): UiTextKey =>
  `state.${kind}.${part}` as UiTextKey;
