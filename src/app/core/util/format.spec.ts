import { describe, expect, it } from 'vitest';
import { hijriDate } from './format';

/** A formatter that answers like a browser would, for testing. */
const fake = (calendar: string, parts: Record<string, string>) =>
  ({
    resolvedOptions: () => ({ calendar }),
    formatToParts: () => Object.entries(parts).map(([type, value]) => ({ type, value })),
  }) as unknown as Intl.DateTimeFormat;

describe('hijriDate', () => {
  it('formats the Umm al-Qura date with its own names', () => {
    expect(hijriDate(new Date('2026-10-05T12:00:00Z'))).toBe('24 Rabiʻ II 1448 AH');
  });

  it('never shows the "BC" some Android browsers put on Islamic dates', () => {
    const android = fake('islamic-umalqura', { month: '4', literal: '/', day: '24', year: '1448', era: 'BC' });
    expect(hijriDate(new Date(), android)).toBe('24 Rabiʻ II 1448 AH');
  });

  it('shows nothing when the browser has no Islamic calendar', () => {
    expect(hijriDate(new Date(), fake('gregory', { month: '10', day: '5', year: '2026' }))).toBe('');
  });
});
