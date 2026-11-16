import { describe, expect, it } from 'vitest';
import { formatInZone, zonedToInstant } from '../app/utils/datetime';
import { nextEnabled } from '../app/utils/menu';
import { formatPhoneForDisplay, maskEmail, maskPhone } from '../app/utils/phone';

describe('phone display helpers (UI-PUB-04, spec 7.4)', () => {
  it('formats local and international numbers without losing or blocking characters', () => {
    expect(formatPhoneForDisplay('0241234567')).toBe('024 123 4567');
    expect(formatPhoneForDisplay('+233241234567')).toBe('+233 24 123 4567');
    expect(formatPhoneForDisplay('  024 123 4567 ')).toBe('024 123 4567');
    expect(formatPhoneForDisplay('')).toBe('');
    expect(formatPhoneForDisplay('abc')).toBe('abc'); // nothing formattable: left as typed
  });

  it('masks phones and emails as the spec shows', () => {
    expect(maskPhone('024 123 4567')).toBe('024 *** ** 67');
    expect(maskEmail('kofi@mail.com')).toBe('k***@mail.com');
    expect(maskEmail('nope')).toBe('***');
  });
});

describe('time zone helpers (UI-BLD-04, UI-I18N-03)', () => {
  it('converts wall-clock time in a zone to the right instant', () => {
    expect(zonedToInstant('2026-11-30', '23:59', 'Africa/Accra')?.toISOString()).toBe(
      '2026-11-30T23:59:00.000Z',
    );
    // London is on BST (UTC+1) in July
    expect(zonedToInstant('2026-07-01', '12:00', 'Europe/London')?.toISOString()).toBe(
      '2026-07-01T11:00:00.000Z',
    );
    expect(zonedToInstant('2026-01-15', '12:00', 'America/New_York')?.toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    );
  });

  it('rejects incomplete input', () => {
    expect(zonedToInstant('', '12:00', 'Africa/Accra')).toBeNull();
    expect(zonedToInstant('2026-11-30', '', 'Africa/Accra')).toBeNull();
  });

  it('always shows the zone abbreviation', () => {
    const instant = zonedToInstant('2026-11-30', '23:59', 'Africa/Accra')!;
    expect(formatInZone(instant, 'Africa/Accra')).toMatch(/30 Nov.*23:59.*GMT/);
    expect(formatInZone(instant, 'America/New_York')).toMatch(/18:59/);
  });
});

describe('menu keyboard movement', () => {
  const enabled = [true, false, true, true];
  it('moves through the items and wraps around, skipping disabled ones', () => {
    expect(nextEnabled(enabled, 0, 'next')).toBe(2);
    expect(nextEnabled(enabled, 3, 'next')).toBe(0);
    expect(nextEnabled(enabled, 0, 'previous')).toBe(3);
    expect(nextEnabled(enabled, 2, 'previous')).toBe(0);
  });
  it('jumps to the first and last enabled item', () => {
    expect(nextEnabled([false, true, true, false], -1, 'first')).toBe(1);
    expect(nextEnabled([false, true, true, false], -1, 'last')).toBe(2);
  });
  it('starts from nothing focused, and handles a menu with nothing to choose', () => {
    expect(nextEnabled(enabled, -1, 'next')).toBe(0);
    expect(nextEnabled([false, false], -1, 'next')).toBe(-1);
    expect(nextEnabled([], -1, 'first')).toBe(-1);
  });
});
