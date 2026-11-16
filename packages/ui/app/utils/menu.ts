/**
 * Which menu item gets focus next. `enabled` says, for each item in order, whether it can be chosen;
 * `current` is the focused item (-1 when none). Arrow keys wrap around, Home and End jump to the ends,
 * and disabled items are skipped. Returns -1 when nothing can be focused.
 */
export function nextEnabled(
  enabled: readonly boolean[],
  current: number,
  key: 'next' | 'previous' | 'first' | 'last',
): number {
  const n = enabled.length;
  if (!enabled.some(Boolean)) return -1;
  if (key === 'first') return enabled.findIndex(Boolean);
  if (key === 'last') return enabled.lastIndexOf(true);
  const step = key === 'next' ? 1 : -1;
  let i = current;
  for (let k = 0; k < n; k++) {
    i = (((i + step) % n) + n) % n;
    if (enabled[i]) return i;
  }
  return -1;
}
