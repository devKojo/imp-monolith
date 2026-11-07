export const SESSION_IDLE_MS = 30 * 60 * 1000; // R-IAM-01: idle timeout 30 minutes
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // absolute timeout 12 hours
/** last_seen_at is refreshed at most this often, to avoid a write per request. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export type SessionTimes = {
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export function isSessionActive(s: SessionTimes, now: Date): boolean {
  if (s.revokedAt) return false;
  if (now >= s.expiresAt) return false; // absolute
  return now.getTime() - s.lastSeenAt.getTime() < SESSION_IDLE_MS; // idle
}

export const shouldTouch = (lastSeenAt: Date, now: Date): boolean =>
  now.getTime() - lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS;

export const absoluteExpiry = (now: Date): Date => new Date(now.getTime() + SESSION_ABSOLUTE_MS);
