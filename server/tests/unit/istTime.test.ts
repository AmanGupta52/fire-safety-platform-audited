import { describe, it, expect } from 'vitest';
import { istStartOfDay, istStartOfMonth, istDayWindow, IST_OFFSET_MS } from '../../src/utils/istTime';

// IST = UTC+5:30 with no daylight saving, so IST midnight is always 18:30 UTC of the previous day.
describe('IST day and month boundaries', () => {
  it('19:00 UTC on 8 Oct is already 9 Oct in India, so "today" starts at 18:30 UTC on 8 Oct', () => {
    const now = new Date('2026-10-08T19:00:00Z');
    expect(istStartOfDay(now).toISOString()).toBe('2026-10-08T18:30:00.000Z');
    expect(istDayWindow(now).end.toISOString()).toBe('2026-10-09T18:30:00.000Z');
  });

  it('18:29 UTC is still the same IST day, 18:30 UTC starts the next one', () => {
    expect(istStartOfDay(new Date('2026-10-08T18:29:59Z')).toISOString()).toBe('2026-10-07T18:30:00.000Z');
    expect(istStartOfDay(new Date('2026-10-08T18:30:00Z')).toISOString()).toBe('2026-10-08T18:30:00.000Z');
  });

  it('mid-day UTC (afternoon IST) stays on the same IST date', () => {
    expect(istStartOfDay(new Date('2026-10-09T08:00:00Z')).toISOString()).toBe('2026-10-08T18:30:00.000Z');
  });

  it('the day window is exactly 24 hours', () => {
    const { start, end } = istDayWindow(new Date('2026-03-15T03:00:00Z'));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('the month starts at 00:00 IST on the 1st, even when UTC is still in the previous month', () => {
    // 31 Oct 19:00 UTC = 1 Nov 00:30 IST -> the IST month is already November.
    expect(istStartOfMonth(new Date('2026-10-31T19:00:00Z')).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    // 31 Oct 18:00 UTC = 31 Oct 23:30 IST -> still October.
    expect(istStartOfMonth(new Date('2026-10-31T18:00:00Z')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });

  it('handles a year boundary', () => {
    expect(istStartOfMonth(new Date('2026-12-31T20:00:00Z')).toISOString()).toBe('2026-12-31T18:30:00.000Z');
    expect(istStartOfMonth(new Date('2027-01-15T10:00:00Z')).toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });

  it('uses a fixed +5:30 offset', () => {
    expect(IST_OFFSET_MS).toBe(19_800_000);
  });
});
