export const LOCK_THRESHOLD = 5; // failures before an account is locked (R-IAM-04, section 15.2)
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_DOUBLINGS = 3; // 15 min, 30 min, 1 h, 2 h cap

/** Progressive delay: null while under the threshold, else when the lock ends. */
export function lockedUntil(failedCount: number, now: Date): Date | null {
  if (failedCount < LOCK_THRESHOLD) return null;
  const doublings = Math.min(failedCount - LOCK_THRESHOLD, MAX_DOUBLINGS);
  return new Date(now.getTime() + BASE_LOCK_MS * 2 ** doublings);
}

export const isLocked = (until: Date | null | undefined, now: Date): boolean =>
  !!until && until > now;
