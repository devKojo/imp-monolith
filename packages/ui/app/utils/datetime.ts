/**
 * Campaign time zone helpers (UI-BLD-04, UI-I18N-03). Dates are always shown with their zone, and
 * a wall-clock time entered in a zone is converted to the right instant even across DST.
 */

/** Offset (ms) of `zone` from UTC at `instant`. */
function zoneOffsetMs(instant: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant at which the wall clock in `zone` reads `date` (YYYY-MM-DD) `time` (HH:mm). */
export function zonedToInstant(date: string, time: string, zone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const wallAsUtc = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(t[1]),
    Number(t[2]),
  );
  // Two passes settle the offset around DST transitions.
  let guess = wallAsUtc - zoneOffsetMs(wallAsUtc, zone);
  guess = wallAsUtc - zoneOffsetMs(guess, zone);
  return new Date(guess);
}

/** "30 Nov, 23:59 GMT": always includes the zone abbreviation. */
export function formatInZone(instant: Date, zone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(instant);
}
